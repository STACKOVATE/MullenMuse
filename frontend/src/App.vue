<template>
  <div class="chat-container">

    <!-- 顶部导航栏 -->
    <header class="top-header">
      <div class="header-left">
        <img src="/MullenMuse.svg" alt="MullenMuse" class="header-logo" />
      </div>
      <div class="header-right">
        <a href="https://ifdian.net/a/mullenmuse" target="_blank" class="header-brand-link sponsor-link">
          <Icon icon="lucide:heart" :width="14" :height="14" class="sponsor-icon" />
          <span>赞助支持</span>
          <Icon icon="lucide:external-link" :width="14" :height="14" class="external-icon" />
        </a>
        <a href="https://stackovate.github.io" target="_blank" class="header-brand-link">
          Made By <span class="brand-name">STACKOVATE</span>
          <Icon icon="lucide:external-link" :width="14" :height="14" class="external-icon" />
        </a>
      </div>
    </header>

    <!-- 主内容区域 -->
    <main class="main-content">

      <!-- 图一：初始状态（未开始对话）- 欢迎界面 -->
      <transition name="welcome-fade">
        <div v-if="!hasStarted && messages.length <= 1" class="welcome-screen" :class="{ 'auto-mode': chatMode === 'auto' }" key="welcome">
          <div class="welcome-content">
            <div class="welcome-icon">
              <Icon :icon="chatMode === 'auto' ? 'lucide:sparkles' : 'lucide:bot-message-square'" :width="48" :height="48" />
            </div>
            <h2 class="welcome-title">
              <template v-if="chatMode === 'auto'">AI 将自动分析你的问题并选择最合适的模型</template>
              <template v-else>选择 AI 后提问，他们会同时回答</template>
            </h2>

            <!-- 模式切换 -->
            <div class="mode-switch-bar">
              <button class="mode-btn" :class="{ active: chatMode === 'auto' }" @click="chatMode = 'auto'; needSummary = true">
                <Icon icon="lucide:sparkles" :width="16" :height="16" />
                <span>全自动</span>
              </button>
              <button class="mode-btn" :class="{ active: chatMode === 'manual' }" @click="chatMode = 'manual'">
                <Icon icon="lucide:settings-2" :width="16" :height="16" />
                <span>手动</span>
              </button>
            </div>

            <!-- 居中的输入框 -->
            <div class="welcome-input-area">
              <button class="select-ai-btn welcome-select-btn" @click.stop.prevent="toggleMenu" title="选择AI"
                :class="{ 'auto-mode-disabled': chatMode === 'auto' }"
                :style="chatMode === 'auto' ? { opacity: 0, width: '0px', minWidth: '0px', padding: 0, margin: 0, overflow: 'hidden', pointerEvents: 'none', transition: 'all 0.3s ease' } : { opacity: 1, pointerEvents: 'auto', transition: 'all 0.3s ease' }">
                <Icon icon="lucide:plus" :width="18" :height="18" />
              </button>
              <textarea v-model="inputText" :placeholder="chatMode === 'auto' ? '输入你的问题，AI 自动匹配模型...' : '输入你的问题...'" @keyup.enter.exact="sendMessage" @keydown.enter.shift.exact.prevent="inputText += '\n'" @input="autoResizeTextarea" :disabled="loading && !verifying"
                class="welcome-chat-input" rows="1"></textarea>
              <button @click="sendMessage" :disabled="loading || !inputText.trim()" class="welcome-send-btn">
                <Icon icon="lucide:send" :width="18" :height="18" />
              </button>

              <!-- AI选择菜单 - 欢迎界面专用 -->
              <transition name="menu-popup">
                <div v-if="showMenu && !hasStarted" class="hamburger-menu new-menu welcome-menu"
                    ref="welcomeMenuRef" @mousedown.stop @click.stop @contextmenu.stop>
                  <div class="menu-title">选择 AI 模型</div>
                  <div class="menu-list">
                    <div v-for="(config, key, index) in AI_CONFIGS" :key="key"
                      class="menu-item-new"
                      :style="{
                        animationDelay: `${index * 0.05}s`
                      }"
                      @click.prevent.stop="toggleAI(key)"
                      @mousedown.stop
                      style="cursor: pointer;">
                      <span class="ai-indicator" :style="{ background: config.color }"></span>
                      <span class="menu-item-name">{{ config.name }}</span>
                      <span class="ai-status" :class="{ 'status-enabled': enabledAIs.includes(key) }">
                        {{ enabledAIs.includes(key) ? '已启用' : '未启用' }}
                      </span>
                    </div>
                  </div>
                </div>
              </transition>
            </div>

            <!-- 提示文字 -->
            <p class="welcome-disclaimer">
              <template v-if="chatMode === 'auto'">
                <Icon icon="lucide:sparkles" :width="14" :height="14" style="margin-right: 4px; vertical-align: -2px;" />
                全自动模式：AI 会根据问题类型自动选择最合适的模型并开启总结
              </template>
              <template v-else>
                内容由AI生成，请仔细甄别
              </template>
            </p>
          </div>
        </div>
      </transition>

      <!-- 图二：对话状态（已开始聊天）- 聊天界面 -->
      <transition name="chat-slide">
        <div v-if="hasStarted || messages.length > 1" class="chat-box" ref="chatBox" key="chat">
          <div v-for="(msg, index) in messages" :key="index" class="message-wrapper">
            <!-- 用户消息 -->
            <div v-if="msg.role === 'user'" class="message user-message">
              <div class="bubble user-bubble">{{ msg.content }}</div>
            </div>
            <!-- AI普通消息（各模型的回答）- 手风琴式折叠面板 -->
            <div v-else-if="!msg.isSummary && msg.aiKey && !msg.isVerification" class="message ai-message accordion-message">
              <div class="accordion-item" :class="{ expanded: msg.expanded, 'has-hallucination': msg.hasHallucination }">
                <!-- 折叠面板标题栏 -->
                <div class="accordion-header" @click="toggleCollapse(index)">
                  <Icon icon="lucide:bot" :width="16" :height="16" class="accordion-icon" />
                  <span class="ai-tag" :style="{ background: msg.color || '#409EFF' }">
                    {{ msg.aiName }}
                  </span>
                  <!-- 右侧：验证按钮 + 状态 + 展开箭头 -->
                  <div class="accordion-right">
                    <span v-if="msg.verificationStatus" class="verify-btn" :class="{ 'is-hallucination': msg.hasHallucination }" :title="msg.verificationText">
                      <Icon v-if="msg.hasHallucination" icon="lucide:shield-alert" :width="14" :height="14" />
                      <Icon v-else icon="lucide:shield-check" :width="14" :height="14" />
                      <span class="verify-label">{{ msg.verificationStatus }}</span>
                    </span>
                    <span class="accordion-status" :class="{ 'status-completed': msg.isCompleted && msg.expanded }">
                      <template v-if="msg.isCompleted && msg.expanded">✓ 回答完成</template>
                      <template v-else-if="msg.content.length > 0">已生成 {{ msg.content.length }} 字</template>
                      <template v-else>正在回答...</template>
                    </span>
                    <Icon :icon="msg.expanded ? 'lucide:chevron-down' : 'lucide:chevron-right'" :width="16" :height="16"
                      class="accordion-arrow" />
                  </div>
                </div>

                <!-- 折叠面板内容区 -->
                <transition name="accordion">
                  <div v-show="msg.expanded" class="accordion-content">
                    <span class="markdown-body" :class="{ 'hallucination-content': msg.hasHallucination }" v-html="sanitize(md.render(fixTableSyntax(msg.content)))"></span>
                  </div>
                </transition>
              </div>
            </div>
            <!-- 系统提示/欢迎消息（直接显示）- 排除初始欢迎语 -->
            <div v-else-if="!msg.isSummary && msg.content !== '选择AI后提问，他们会同时回答'" class="message ai-message">
              <div class="bubble ai-bubble">
                <span class="markdown-body" v-html="sanitize(md.render(fixTableSyntax(msg.content)))"></span>
              </div>
            </div>
            <!-- AI总结消息（独立气泡）- 所有AI完成后才显示 -->
            <div v-else v-show="msg.showSummary || msg.isGenerating" class="message ai-message summary-message">
              <div class="bubble summary-bubble">
                <span class="ai-tag summary-tag">综合总结</span>

                <!-- 正在生成中：显示加载动画 -->
                <div v-if="msg.isGenerating && !msg.showSummary" class="summary-generating">
                  <div class="generating-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <p>正在综合分析所有AI的回答...</p>
                </div>

                <!-- 生成完成：显示内容 -->
                <div v-else-if="msg.content" class="summary-content-wrapper markdown-body" v-html="sanitize(md.render(fixTableSyntax(msg.content)))">
                </div>
              </div>
            </div>
          </div>
          <!-- 加载状态 -->
          <div v-if="loading || analyzingQuestion || verifying" class="loading-text">
            <template v-if="analyzingQuestion && chatMode === 'auto'">
              <Icon icon="lucide:sparkles" :width="16" :height="16" style="margin-right: 6px; animation: spin 1s linear infinite;" />
              🧠 GLM-5 正在智能分析你的问题...
            </template>
            <template v-else-if="verifying">
              <Icon icon="lucide:shield-check" :width="16" :height="16" style="margin-right: 6px; animation: pulse 1.5s ease-in-out infinite; color: #f59e0b;" />
              🔍 GLM-4.7-FlashX 正在联网验证回答真实性...
            </template>
            <template v-else-if="loading">
              <template v-if="chatMode === 'auto'">
                <Icon icon="lucide:check-circle" :width="14" :height="14" style="margin-right: 4px; color: #10b981;" />
                已自动选择 {{ enabledAIs.length }} 个{{ enabledAIs.length > 1 ? 'AI' : 'AI' }}，正在回答...
              </template>
              <template v-else>
                正在同时询问 {{ enabledAIs.length }} 个AI，请稍候...
              </template>
            </template>
          </div>
        </div>
      </transition>
    </main>

    <!-- 底部输入栏 - 只在对话状态显示 -->
    <footer v-if="hasStarted || messages.length > 1" class="bottom-bar">
      <div class="input-area-new">
        <!-- 左侧：选择AI按钮 + 模式切换 -->
        <div class="input-left-group">
          <button class="select-ai-btn" @click.stop="toggleMenu" title="选择AI"
            :class="{ 'auto-mode-disabled': chatMode === 'auto' }"
            :style="chatMode === 'auto' ? { opacity: 0, width: '0px', minWidth: '0px', padding: 0, margin: 0, overflow: 'hidden', pointerEvents: 'none', transition: 'all 0.3s ease' } : { opacity: 1, pointerEvents: 'auto', transition: 'all 0.3s ease' }">
            <Icon icon="lucide:plus" :width="18" :height="18" />
          </button>

          <!-- 模式切换按钮组 -->
          <div class="mode-toggle-mini">
            <button class="mode-btn-mini" :class="{ active: chatMode === 'auto' }"
              @click="chatMode = 'auto'; needSummary = true" title="全自动模式">
              <Icon icon="lucide:sparkles" :width="14" :height="14" />
            </button>
            <button class="mode-btn-mini" :class="{ active: chatMode === 'manual' }"
              @click="chatMode = 'manual'" title="手动模式">
              <Icon icon="lucide:settings-2" :width="14" :height="14" />
            </button>
          </div>

          <!-- 总结开关（仅手动模式显示） -->
          <button v-if="chatMode === 'manual'" class="summary-toggle-btn"
            :class="{ active: needSummary }" @click="toggleSummary" :title="needSummary ? '已开启总结' : '已关闭总结'">
            <Icon icon="lucide:file-text" :width="14" :height="14" />
            <span class="summary-toggle-text">{{ needSummary ? '总结' : '无总结' }}</span>
          </button>
        </div>

        <!-- 中间：输入框 -->
        <div class="input-wrapper">
          <textarea v-model="inputText" :placeholder="chatMode === 'auto' ? '输入你的问题，AI 自动匹配模型...' : '输入你的问题...'" @keyup.enter.exact="sendMessage" @keydown.enter.shift.exact.prevent="inputText += '\n'" @input="autoResizeTextarea" :disabled="loading && !verifying"
            class="chat-input-new" rows="1"></textarea>
        </div>

        <!-- 右侧：操作按钮组 -->
        <div class="action-buttons">
          <button class="action-btn reset-action-btn" @click="resetChat" :disabled="messages.length <= 1"
            title="清空聊天记录">
            <Icon icon="lucide:trash-2" :width="16" :height="16" />
            <span class="btn-text">清空</span>
          </button>
          <button @click="sendMessage" :disabled="loading" class="action-btn send-action-btn">
            <Icon v-if="!loading" icon="lucide:send" :width="16" :height="16" />
            <Icon v-else icon="lucide:loader-2" :width="16" :height="16" class="spin" />
          </button>
        </div>

        <!-- AI选择菜单 - 在[+]按钮正上方弹出 -->
        <transition name="menu-popup">
          <div v-if="showMenu" class="hamburger-menu new-menu" ref="menuRef">
            <div class="menu-title">选择 AI 模型</div>
            <div class="menu-list">
              <label v-for="(config, key, index) in AI_CONFIGS" :key="key" class="menu-item-new"
                :style="{ animationDelay: `${index * 0.05}s` }" @click.prevent="toggleAI(key)">
                <span class="ai-indicator" :style="{ background: config.color }"></span>
                <span class="menu-item-name">{{ config.name }}</span>
                <span class="ai-status" :class="{ 'status-enabled': enabledAIs.includes(key) }">
                  {{ enabledAIs.includes(key) ? '已启用' : '未启用' }}
                </span>
              </label>
            </div>
          </div>
        </transition>
      </div>

      <div class="disclaimer-new">内容由AI生成，请仔细甄别</div>
      </footer>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { Icon } from '@iconify/vue'
import MarkdownIt from 'markdown-it'
import texmath from 'markdown-it-texmath'
import katex from 'katex'
import 'katex/dist/katex.min.css'  // 引入 KaTeX 样式
import DOMPurify from 'dompurify'

/**
 * 对HTML内容进行净化处理，只保留允许的标签和属性
 * @param {string} html - 需要净化的HTML字符串
 * @returns {string} 净化后的安全HTML字符串
 */
const sanitize = (html) => {
  return DOMPurify.sanitize(html, {
    // 允许使用的HTML标签列表
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                   'ul', 'ol', 'li', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
                   'a', 'span', 'div', 'mark', 'sup', 'sub',
                   'annotation', 'semantics', 'math', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac',
                   'munder', 'mover', 'munderover', 'msqrt', 'mroot', 'mstyle', 'mtext', 'mpadded',
                   'mphantom', 'mglyph', 'merror', 'mfenced', 'mspace', 'mlabeledtr', 'mtd', 'mtr',
                   'none', 'mprescripts', 'multiscripts', 'svg', 'path'],
    // 允许使用的HTML属性列表
    ALLOWED_ATTR: ['href', 'target', 'class', 'id', 'style', 'title',
                   'xmlns', 'viewBox', 'd', 'fill', 'stroke', 'stroke-width',
                   'displaystyle', 'scriptlevel', 'fence', 'separator', 'notation',
                   'accent', 'accentunder', 'bevelled', 'denomalign', 'linethickness',
                   'numalign', 'rowspacing', 'columnspacing', 'rowlines', 'columnlines',
                   'frame', 'framespacing', 'equalrows', 'equalcolumns', 'rowalign',
                   'columnalign', 'groupalign', 'align', 'alignment', 'charoff',
                   'chars', 'charalign', 'span', 'width', 'height', 'depth', 'maxsize',
                   'minsize', 'lquote', 'rquote', 'linelength', 'voffset', 'background',
                   'color', 'fontfamily', 'fontsize', 'fontstyle', 'fontweight',
                   'maxwidth', 'minwidth', 'maxheight', 'minheight', 'altimg', 'alttext',
                   'src', 'encoding', 'definitionURL', 'cd']
  })
}

// 创建 markdown-it 实例，启用数学插件和GFM表格
const md = new MarkdownIt({
  html: true,        // ✅ 允许 HTML 标签（关键！）
  breaks: true,      // 允许换行符
  linkify: true,     // 自动识别链接
  typographer: true, // 启用排版优化（引号替换等）
})
  .enable(['table']) // 🔑 显式启用 GFM 表格支持（关键！）
  .use(texmath, {
    engine: katex,
    delimiters: ['dollars', 'display'],
    // 支持 $...$ 行内公式 和 $$...$$ 块级公式
    katexOptions: {
      strict: false,          // 关闭严格模式，避免中文警告
      throwOnError: false,    // 不抛出错误，只显示原始文本
      errorColor: '#cc0000'   // 错误时显示红色
    }
  })

// 🧪 Markdown 渲染测试（页面加载时执行一次）- 增强版（含表格）
const testMarkdownRender = () => {
  const testCases = [
    { name: '加粗', input: '**这是加粗**', expected: '<strong>' },
    { name: '斜体', input: '*这是斜体*', expected: '<em>' },
    { name: '行内代码', input: '`代码`', expected: '<code>' },
    { name: '有序列表', input: '1. 第一项\n2. 第二项', expected: '<ol>' },
    { name: '无序列表', input: '- 项目A\n- 项目B', expected: '<ul>' },
    { name: '标题', input: '## 标题', expected: '<h2>' },
    { name: '链接', input: '[链接](https://example.com)', expected: '<a' },
    { name: '数学公式', input: '$E=mc^2$', expected: 'katex' },
    // 🔑 新增：表格测试
    { name: 'GFM表格', 
      input: '| 列1 | 列2 |\n|-----|-----|\n| 数据1 | 数据2 |', 
      expected: '<table' 
    },
    { name: '复杂表格',
      input: '| 姓名 | 年龄 | 城市 |\n|------|------|------|\n| 张三 | 25 | 北京 |\n| 李四 | 30 | 上海 |',
      expected: '<tbody>'
    }
  ]

  console.group('🧪 Markdown 全面测试（含表格）')

  let allPassed = true

  testCases.forEach(({ name, input, expected }) => {
    const output = md.render(input)
    const passed = output.includes(expected)

    if (!passed) allPassed = false

    console.log(`${passed ? '✅' : '❌'} ${name}:`)
    console.log(`   输入:`, input.replace(/\n/g, '\\n').substring(0, 80))
    console.log(`   输出:`, output.substring(0, 120) + (output.length > 120 ? '...' : ''))
    console.log(`   净化后:`, sanitize(output).substring(0, 120))
  })

  if (allPassed) {
    console.log('🎉 所有 Markdown 功能正常！（包括表格）')
  } else {
    console.error('⚠️ 部分功能异常，请检查上方日志')
  }

  console.groupEnd()
}

// 🔍 实时调试：监控最近一条消息的渲染（超级增强版 - 含表格修复）
window.__debugMarkdown = () => {
  const lastMsg = messages.value[messages.value.length - 1]
  if (!lastMsg || !lastMsg.content) {
    console.warn('没有可用的消息')
    return
  }

  const rawContent = lastMsg.content
  const cleanedContent = cleanContent(rawContent)
  const fixedContent = fixTableSyntax(cleanedContent)  // 🆕 应用表格修复
  const mdOutput = md.render(fixedContent)
  const sanitizedHTML = sanitize(mdOutput)

  console.group('📝 最近消息完整调试（含完整修复流程）')
  console.log(`🤖 AI模型:`, lastMsg.aiName || '未知')
  console.log(`📏 内容长度:`, rawContent.length, '字符')

  // 显示原始内容（前350字符）
  console.log('\n📄 阶段1 - 原始内容 (AI返回的原始数据):')
  console.log(rawContent.substring(0, 350))

  // 显示清理后的内容
  console.log('\n🧹 阶段2 - cleanContent处理后:')
  console.log(cleanedContent.substring(0, 350))

  // 显示表格修复后的内容（关键！）
  console.log('\n🔧 阶段3 - fixTableSyntax处理后 (最终用于渲染):')
  console.log(fixedContent.substring(0, 350))

  // 对比差异
  console.log('\n📊 处理流程长度变化:')
  console.log(`   原始: ${rawContent.length} 字符`)
  console.log(`   清理后: ${cleanedContent.length} 字符 (+${cleanedContent.length - rawContent.length})`)
  console.log(`   表格修复后: ${fixedContent.length} 字符 (+${fixedContent.length - cleanedContent.length})`)

  // Markdown 渲染结果
  console.log('\n🎨 阶段4 - Markdown 渲染输出:')
  console.log(mdOutput.substring(0, 300))

  // 净化后结果
  console.log('\n🧹 阶段5 - DOMPurify 净化后 HTML:')
  console.log(sanitizedHTML.substring(0, 300))

  // 关键标签检测（重点检查表格）
  const tags = [
    { tag: '<table', name: '表格' },
    { tag: '<strong', name: '加粗' },
    { tag: '<em', name: '斜体' },
    { tag: '<ol', name: '有序列表' },
    { tag: '<ul', name: '无序列表' },
    { tag: '<h2', name: '标题H2' },
    { tag: '<h3', name: '标题H3' },
    { tag: '<code', name: '代码' }
  ]

  console.log('\n🏷️ 最终HTML标签统计:')
  tags.forEach(({ tag, name }) => {
    const count = (sanitizedHTML.match(new RegExp(tag, 'g')) || []).length
    const status = count > 0 ? `✅ ${count}个` : '❌ 无'
    console.log(`   ${name.padEnd(10, ' ')} ${status}`)
  })

  // 表格专项检测（在修复后的内容上检测）
  const tablePattern = /\|.+\|\s*\n\s*\|[\s\-:]+\|\s*\n\s*\|.+\|/
  const hasValidTableBefore = tablePattern.test(cleanedContent)
  const hasValidTableAfter = tablePattern.test(fixedContent)
  console.log(`\n📊 表格有效性验证:`)
  console.log(`   修复前 (cleanContent): ${hasValidTableBefore ? '✅ 有效' : '❌ 无效/未发现'}`)
  console.log(`   修复后 (fixTableSyntax): ${hasValidTableAfter ? '✅ 有效' : '❌ 无效/未发现'}`)

  console.groupEnd()

  return { rawContent, cleanedContent, fixedContent, mdOutput, sanitizedHTML }
}

// 🔍 调试特定AI模型的渲染（带完整修复链对比）
window.__debugAI = (aiKey) => {
  const aiMessages = messages.value.filter(m => m.aiKey === aiKey && m.role === 'assistant')
  if (!aiMessages.length) {
    console.warn(`未找到 AI (${aiKey}) 的消息`)
    return
  }

  const msg = aiMessages[aiMessages.length - 1]
  const rawContent = msg.content || ''
  const cleanedContent = cleanContent(rawContent)
  const fixedContent = fixTableSyntax(cleanedContent)

  console.group(`🔍 调试 AI: ${msg.aiName} (${aiKey}) - 完整处理链`)
  console.log(`📏 长度变化: ${rawContent.length} → ${cleanedContent.length} → ${fixedContent.length}`)

  console.log('\n1️⃣ 原始内容 (前400字符):')
  console.log(rawContent.substring(0, 400))

  console.log('\n2️⃣ cleanContent处理后 (前400字符):')
  console.log(cleanedContent.substring(0, 400))

  console.log('\n3️⃣ fixTableSyntax处理后 (前400字符):')
  console.log(fixedContent.substring(0, 400))

  console.log('\n4️⃣ 最终Markdown渲染结果 (前350字符):')
  const rendered = md.render(fixedContent)
  console.log(rendered.substring(0, 350))

  console.log('\n🏷️ 标签检测结果:')
  const hasTable = rendered.includes('<table')
  const hasList = rendered.includes('<ol>') || rendered.includes('<ul>')
  const hasStrong = rendered.includes('<strong')
  console.log(`   表格 <table>: ${hasTable ? '✅ 发现' : '❌ 未发现'} ${hasTable ? `(${(rendered.match(/<table/g) || []).length}个)` : ''}`)
  console.log(`   列表 <ol>/<ul>: ${hasList ? '✅ 发现' : '❌ 未发现'}`)
  console.log(`   加粗 <strong>: ${hasStrong ? '✅ 发现' : '❌ 未发现'}`)

  // 如果没有表格，显示可能的原因
  if (!hasTable && rawContent.includes('|')) {
    console.log('\n⚠️ 内容包含 | 但未生成 <table>，可能原因:')
    console.log('   1. 表格语法不完整（缺少分隔符行 ---）')
    console.log('   2. 分隔符行格式不正确')
    console.log('   3. 表格行数不足（至少需要表头+分隔符+1行数据）')
  }

  console.groupEnd()

  return { rawContent, cleanedContent, fixedContent, rendered }
}

// 🔬 深度诊断：分析原始内容的表格结构
window.__diagnoseTable = (aiKey) => {
  const targetMessages = aiKey
    ? messages.value.filter(m => m.aiKey === aiKey && m.role === 'assistant')
    : messages.value.filter(m => m.role === 'assistant')

  if (!targetMessages.length) {
    console.warn('没有找到消息')
    return
  }

  const msg = targetMessages[targetMessages.length - 1]
  const content = msg.content || ''

  console.group(`🔬 表格结构深度诊断 - ${msg.aiName || '最后一条消息'}`)

  // 提取所有包含 | 的行
  const lines = content.split('\n')
  const tableLines = lines.filter(line => line.includes('|'))

  console.log(`\n📊 找到 ${tableLines.length} 行包含 '|' 的内容:\n`)

  tableLines.forEach((line, index) => {
    const cells = line.split('|').filter(c => c.trim())
    const isSeparator = /^[\s\-:|]+$/.test(line)
    const cellCount = cells.length

    console.log(`${index + 1}. [${isSeparator ? '分隔符' : '数据'}] (${cellCount}列)`)
    console.log(`   原始: "${line}"`)
    console.log(`   单元格: [${cells.map(c => `"${c.trim()}"`).join(', ')}]`)
  })

  // 检测是否构成有效表格
  let validTables = []
  let currentTable = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.includes('|')) {
      currentTable.push({ index: i + 1, content: line })
    } else if (currentTable.length > 0) {
      if (currentTable.length >= 3) {
        validTables.push([...currentTable])
      }
      currentTable = []
    }
  }

  if (currentTable.length >= 3) {
    validTables.push(currentTable)
  }

  console.log(`\n🎯 检测到 ${validTables.length} 个可能的表格:`)

  validTables.forEach((table, tIndex) => {
    console.log(`\n--- 表格 ${tIndex + 1} (第 ${table[0].index}-${table[table.length-1].index} 行) ---`)
    console.log(`行数: ${table.length}`)
    table.forEach((row, rIndex) => {
      const cells = row.content.split('|').filter(c => c.trim())
      console.log(`  第${rIndex + 1}行: [${cells.length}单元格] ${cells.map(c => c.trim()).join(' | ')}`)
    })
  })

  if (validTables.length === 0) {
    console.log('\n❌ 未检测到有效的表格结构')
    console.log('提示: 有效表格需要至少3行 (表头 + 分隔符 + 数据)')
  }

  console.groupEnd()

  return { lines, tableLines, validTables }
}

// 页面加载时测试
if (typeof window !== 'undefined') {
  setTimeout(testMarkdownRender, 1000)
}




// ---------- 1. AI配置中心（在这里加新AI） ----------


/**
新名字: {
  name: '显示名称',
  url: 'https://openrouter.ai/api/v1/chat/completions',  
  key: import.meta.env.VITE_OPENROUTER_KEY,
  model: '厂商/模型名:free',  
  color: '#颜色代码'
}OLD
 */


// 这个只用来显示，不包含密钥（必须与 functions/api/chat.js 保持一致）
const AI_CONFIGS = {
  zhipu: { name: 'GLM-4-Flash', color: '#6C5CE7' },
  GLM5: { name: 'GLM-5', color: '#1890FF' },
  openrouter: { name: 'Nemotron-3-Ultra-550B', color: '#00B894' },
  gemma: { name: 'Gemma-4-26B', color: '#FFC107' },
  GLM4f: { name: 'GLM-4.7-FlashX', color: '#7db300' },
  GLM5_1: { name: 'GLM-5.1', color: '#00afaf' },
  emoh: { name: 'Emohaa(心理咨询模型)', color: '#cc00d3' }
}




// ---------- 2. 状态变量 ----------

// 从 localStorage 恢复聊天记录
const savedMessages = typeof localStorage !== 'undefined' ? localStorage.getItem('chatMessages') : null
const defaultMessages = [
  { role: 'assistant', aiName: '', content: '选择AI后提问，他们会同时回答', color: '#999' }
]
const messages = ref(savedMessages ? JSON.parse(savedMessages) : defaultMessages)

const inputText = ref('')
const loading = ref(false)
const analyzingQuestion = ref(false)  // 🆕 全自动模式下分析问题的加载状态
const chatBox = ref(null)
const chatMode = ref('auto')     // 模式：'auto' 全自动 | 'manual' 手动
const needSummary = ref(true)    // 是否需要总结（手动模式下可切换，自动模式始终为true）
const hasStarted = ref(false)    // 是否已开始对话（用于切换界面）

// 验证相关状态
const verifying = ref(false)
const verifyResult = ref(null)
const verifyText = ref('')

// 持久化聊天记录到 localStorage（限制保存最近50条消息，防止存储溢出）
watch(messages, (v) => {
  try {
    const toSave = v.slice(-50)
    localStorage.setItem('chatMessages', JSON.stringify(toSave))
  } catch (e) {
    console.warn('保存聊天记录失败:', e)
  }
}, { deep: true })

// 重置聊天记录
const resetChat = () => {
  if (messages.value.length <= 1) {
    console.log('ℹ️ 没有需要清空的聊天记录')
    return
  }

  if (confirm('确定要清空所有聊天记录吗？')) {
    console.log('🗑️ 清空聊天记录')

    // 停止所有正在进行的请求
    if (window.activeControllers) {
      window.activeControllers.forEach(controller => {
        try {
          controller.abort()
        } catch (e) {
          console.warn('中止请求失败:', e)
        }
      })
      window.activeControllers = []
    }

    // 重置状态
    messages.value = [...defaultMessages]
    localStorage.removeItem('chatMessages')
    hasStarted.value = false
    inputText.value = ''
    loading.value = false
    analyzingQuestion.value = false

    // 重置为默认模式设置
    if (chatMode.value === 'auto') {
      enabledAIs.value = ['GLM5']  // 自动模式重置为单模型
    }

    console.log('✅ 聊天记录已清空，回到初始状态')
  }
}


// 从 localStorage 恢复用户选择，默认启用前两个模型
const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('enabledAIs') : null
let defaultAIs = ['GLM5', 'openrouter']  // 默认：GLM-5 + Nemotron

try {
  if (saved) {
    const parsed = JSON.parse(saved)
    if (Array.isArray(parsed) && parsed.length > 0) {
      defaultAIs = parsed  // 使用保存的设置
    }
  }
} catch (e) {
  console.warn('读取AI配置失败，使用默认值')
}

const enabledAIs = ref(defaultAIs)

// 持久化用户的勾选到 localStorage
watch(enabledAIs, (v) => {
  try {
    localStorage.setItem('enabledAIs', JSON.stringify(v))
  } catch (e) {
    // ignore
  }
}, { deep: true })

// 🆕 自动调整 textarea 高度（动态基准法 - 按元素计算自然高度）
const GROW_THRESHOLD = 20     // 超过基准多少像素才增高
const baseHeightCache = new WeakMap()  // 缓存每个 textarea 的自然单行高度

const getBaseHeight = (textarea) => {
  if (baseHeightCache.has(textarea)) return baseHeightCache.get(textarea)

  const prevHeight = textarea.style.height
  textarea.style.height = 'auto'
  void textarea.offsetHeight
  const naturalHeight = textarea.scrollHeight
  textarea.style.height = prevHeight || ''
  baseHeightCache.set(textarea, naturalHeight)
  return naturalHeight
}

const autoResizeTextarea = (event) => {
  const textarea = event.target
  if (!textarea || textarea.tagName !== 'TEXTAREA') return

  const computedStyle = getComputedStyle(textarea)
  const maxHeight = parseFloat(computedStyle.maxHeight) || 120

  const baseHeight = getBaseHeight(textarea)
  const currentHeight = parseFloat(textarea.style.height) || baseHeight

  // 空内容 → 回到自然单行高度
  if (!textarea.value.trim()) {
    if (Math.abs(currentHeight - baseHeight) > 1) {
      textarea.style.height = baseHeight + 'px'
    }
    return
  }

  // 测量 scrollHeight
  textarea.style.height = 'auto'
  void textarea.offsetHeight
  const scrollHeight = textarea.scrollHeight

  // 内容不足以换行，保持基准高度
  if (scrollHeight <= baseHeight + GROW_THRESHOLD) {
    if (Math.abs(currentHeight - baseHeight) > 1) {
      textarea.style.height = baseHeight + 'px'
    }
    return
  }

  // 真正需要增高
  let finalHeight = Math.min(scrollHeight, maxHeight)
  finalHeight = Math.round(finalHeight)

  if (Math.abs(currentHeight - finalHeight) > 1) {
    textarea.style.height = finalHeight + 'px'
  }
}

// 监听输入文本变化，自动调整高度
watch(inputText, () => {
  nextTick(() => {
    const textareas = document.querySelectorAll('textarea.welcome-chat-input, textarea.chat-input-new')
    textareas.forEach(textarea => {
      autoResizeTextarea({ target: textarea })
    })
  })
}, { immediate: true })

onMounted(() => {
  nextTick(() => {
    const textareas = document.querySelectorAll('textarea.welcome-chat-input, textarea.chat-input-new')
    textareas.forEach(textarea => {
      autoResizeTextarea({ target: textarea })
    })
  })
})

// 汉堡菜单状态
const showMenu = ref(false)
const menuRef = ref(null)
const welcomeMenuRef = ref(null)

const toggleMenu = () => {
  if (chatMode.value === 'auto') return  // 全自动模式下不允许打开菜单
  showMenu.value = !showMenu.value
}

const toggleAI = (key) => {
  if (chatMode.value === 'auto') return  // 全自动模式下不允许手动切换
  const index = enabledAIs.value.indexOf(key)
  if (index > -1) {
    enabledAIs.value.splice(index, 1)
  } else {
    enabledAIs.value.push(key)
  }
}

// 🔄 切换模式：全自动 <-> 手动
const toggleMode = () => {
  if (chatMode.value === 'auto') {
    chatMode.value = 'manual'
    needSummary.value = true  // 手动模式默认开启总结
  } else {
    chatMode.value = 'auto'
    needSummary.value = enabledAIs.value.length >= 2  // 自动模式：≥2个AI才总结
  }
}

// 🧠 全自动模式：使用 GLM-5 AI 智能分析用户问题，自动选择模型
const autoAnalyzeQuestion = async (question) => {
  // 🚀 快速路径：仅拦截极简纯问候（不调API）
  const q = question.trim()
  const pureGreetings = /^(你好|您好|嗨|hi|hello|hey|早上好|晚上好|下午好|谢谢|感谢|thank|bye|再见|ok|好的)[\s！!。.,?？~～]*$/i
  if (pureGreetings.test(q)) {
    console.log('⚡ 纯问候，直接使用 GLM-5')
    return ['GLM5']
  }

  analyzingQuestion.value = true

  try {
    const glm5Config = AI_CONFIGS['GLM5']
    if (!glm5Config || !glm5Config.key) {
      console.warn('GLM-5 配置缺失，使用默认模型')
      return ['GLM5']
    }

    const response = await fetch(glm5Config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${glm5Config.key}`
      },
      body: JSON.stringify({
        model: glm5Config.model,
        stream: false,
        messages: [
          {
            role: 'system',
            content: `你是AI调度助手。根据问题复杂度选1-3个模型。

**默认倾向：大多数问题用2个AI，只有极简闲聊才用1个！**

🟢 **只用1个模型（GLM5）** — 仅限以下情况：
- 纯打招呼、问候、寒暄："你好"、"谢谢"、"再见"
- 极短闲聊（<8字）：如"OK"、"嗯嗯"、"哈哈"
- 纯时间/天气查询

🟡 **默认用2个模型** — 以下情况：
- 任何知识性/解释性问题（"XXX是什么/怎么"）
- 单一领域专业问题
- 需要对比或验证的问题
- 大多数有实质内容的问题

🔴 **用3个模型** — 以下情况：
- 跨领域复杂问题
- 需要多角度深度分析
- 涉及心理+技术+时事等多维度

可用模型：GLM5(通用)、emoh(心理)、openrouter(编程)、GLM4f(创作)、GLM5_1(时事)、zhipu(常识)

只返回JSON数组，如 ["GLM5"] 或 ["openrouter","GLM5"] 或 ["emoh","GLM5","zhipu"]
**宁多勿少：不确定时优先选2个AI！**`
          },
          { role: 'user', content: question }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`GLM-5 分析失败: ${response.status}`)
    }

    const data = await response.json()
    const aiResponse = data.choices?.[0]?.message?.content || ''

    console.log('🧠 GLM-5 分析结果:', aiResponse)

    let selectedModels = []

    try {
      const parsed = JSON.parse(aiResponse.replace(/```json?|```/g, '').trim())
      if (Array.isArray(parsed)) {
        selectedModels = parsed
      }
    } catch (e) {
      const validKeys = Object.keys(AI_CONFIGS)
      const matches = aiResponse.match(/\b(emoh|GLM5|openrouter|GLM4f|GLM5_1|zhipu)\b/gi)
      if (matches && matches.length > 0) {
        selectedModels = [...new Set(matches.map(m => m.toLowerCase()))]
        selectedModels = selectedModels.map(key => {
          const found = validKeys.find(v => v.toLowerCase() === key)
          return found || key
        }).filter(key => AI_CONFIGS[key])
      }
    }

    if (selectedModels.length === 0) {
      console.warn('GLM-5 未返回有效模型，使用默认')
      selectedModels = ['GLM5']
    } else if (selectedModels.length > 3) {
      selectedModels = selectedModels.slice(0, 3)
    }

    console.log(`📊 GLM-5返回: [${selectedModels.join(', ')}]`)

    // 🛡️ 硬性规则：非纯问候一律至少2个AI（不管GLM-5怎么说）
    if (selectedModels.length === 1 && !pureGreetings.test(q)) {
      console.log('🔄 硬性补选第2个AI')
      const lowerQ = q.toLowerCase()
      let secondModel = 'zhipu'
      if (/代码|编程|python|java|js|前端|后端|开发|debug|api|框架|算法/i.test(lowerQ)) secondModel = 'openrouter'
      else if (/心理|情绪|焦虑|抑郁|压力|关系|感情|恋爱|婚姻|性格|mbti|人格/i.test(lowerQ)) secondModel = 'emoh'
      else if (/写|创作|文章|文案|故事|诗歌|翻译|改写|润色|总结/i.test(lowerQ)) secondModel = 'GLM4f'
      else if (/新闻|时事|政治|经济|军事|国际|社会|热点/i.test(lowerQ)) secondModel = 'GLM5_1'
      if (!selectedModels.includes(secondModel)) selectedModels.push(secondModel)
    }

    console.log(`✅ 最终选择 (${selectedModels.length}个):`,
      selectedModels.map(k => `${AI_CONFIGS[k]?.name || k}`)
    )

    return selectedModels

  } catch (error) {
    console.error('❌ GLM-5 分析出错:', error)
    return ['GLM5']
  } finally {
    analyzingQuestion.value = false
  }
}

// 切换总结开关（仅手动模式可用）
const toggleSummary = () => {
  if (chatMode.value === 'manual') {
    needSummary.value = !needSummary.value
  }
}

// 👁️ 监听 enabledAIs 变化，自动调整总结开关
watch(enabledAIs, (newVal) => {
  // 手动模式下，如果只选了1个AI，自动关闭总结
  if (chatMode.value === 'manual' && newVal.length === 1 && needSummary.value) {
    needSummary.value = false
    console.log(' 只选了1个AI，自动关闭总结')
  }
}, { deep: true })

const onDocClick = (e) => {
  const welcomeMenu = welcomeMenuRef.value
  const chatMenu = menuRef.value

  let clickedInsideMenu = false

  if (welcomeMenu && welcomeMenu.contains(e.target)) {
    clickedInsideMenu = true
  }

  if (chatMenu && chatMenu.contains(e.target)) {
    clickedInsideMenu = true
  }

  if (!clickedInsideMenu) {
    showMenu.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

// ---------- 3. 折叠/展开功能 ----------
const toggleCollapse = (index) => {
  if (messages.value[index]) {
    messages.value[index].expanded = !messages.value[index].expanded
  }
}

// 获取预览文本（截取前150字符，在句子边界处截断）
const getPreviewText = (content) => {
  if (!content) return ''

  const maxLength = 150
  if (content.length <= maxLength) return content

  // 尝试在句子边界（句号、问号、感叹号、分号）处截断
  let truncated = content.substring(0, maxLength)

  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('。'),
    truncated.lastIndexOf('！'),
    truncated.lastIndexOf('？'),
    truncated.lastIndexOf('；')
  )

  if (lastSentenceEnd > maxLength * 0.6) {
    // 如果找到合适的句子结尾（至少在60%位置之后），在那里截断
    return content.substring(0, lastSentenceEnd + 1)
  }

  // 否则在最后一个空格或换行符处截断
  const lastSpace = Math.max(
    truncated.lastIndexOf(' '),
    truncated.lastIndexOf('\n')
  )

  if (lastSpace > maxLength * 0.7) {
    return content.substring(0, lastSpace)
  }

  // 最后直接截断到maxLength
  return truncated
}

// ---------- 4. 高亮功能 ----------

const highlightDuplicates = (originalContent, summary) => {
  if (!summary || !originalContent) return originalContent

  const stripHtml = (text) => text.replace(/<[^>]*>/g, ' ')

  const plainSummary = stripHtml(summary).replace(/[#*_`\[\](){}\\$~^+=|<>-]/g, ' ').replace(/\s+/g, ' ')
  const plainOriginal = stripHtml(originalContent).replace(/[#*_`\[\](){}\\$~^+=|<>-]/g, ' ').replace(/\s+/g, ' ')

  const summarySentences = plainSummary.split(/(?<=[。！？；])/).filter(s => s.trim().length > 8)

  let highlightedContent = originalContent
  let totalHighlights = 0

  summarySentences.forEach(sentence => {
    const trimmedSentence = sentence.trim()
    if (trimmedSentence.length < 8) return

    const keywords = trimmedSentence
      .replace(/[了的在是这有和与或但而因所以，。！？；：""''（）《》【】、]/g, '')
      .trim()

    if (keywords.length < 6) return

    const searchLength = Math.min(keywords.length, 20)
    const searchText = keywords.slice(0, searchLength)

    if (!plainOriginal.includes(searchText)) return

    try {
      const escapedSearch = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(escapedSearch, 'i')

      let safe = 0
      while (safe < 5) {
        const match = highlightedContent.match(regex)
        if (!match || match.index === undefined) break

        let start = match.index
        let end = match.index + match[0].length

        while (start > 0 && !/[。！？；\n]/.test(highlightedContent[start - 1])) start--
        while (end < highlightedContent.length && !/[。！？；\n]/.test(highlightedContent[end])) end++

        const textToHighlight = highlightedContent.substring(start, end)

        if (textToHighlight.length >= 12 && !textToHighlight.includes('<mark')) {
          const highlightedText = `<mark class="duplicate-highlight" title="此内容出现在综合总结中">${textToHighlight}</mark>`
          highlightedContent = highlightedContent.substring(0, start) + highlightedText + highlightedContent.substring(end)
          totalHighlights++
        } else {
          break
        }

        safe++
      }
    } catch (e) {
      // ignore regex errors
    }
  })

  if (totalHighlights > 0) {
    console.log(`  🟡 在原始回答中标记了 ${totalHighlights} 处与总结重复的内容`)
  }

  return highlightedContent
}

const highlightDuplicatesInOriginals = () => {
  console.log('🔍 开始检测总结与原始回答的重复内容...')

  const summaryMsg = messages.value.find(m => m.isSummary && m.content && m.content.trim().length > 0)
  if (!summaryMsg) {
    console.log('⚠️ 未找到总结消息，跳过高亮')
    return
  }

  const aiMessages = messages.value.filter(m =>
    m.aiKey && !m.isSummary && !m.isVerification && m.role === 'assistant' && m.content && m.content.trim().length > 30
  )

  console.log(`📊 找到 ${aiMessages.length} 个AI回答可用于比对，总结长度: ${summaryMsg.content.length} 字`)

  if (aiMessages.length === 0) return

  aiMessages.forEach(aiMsg => {
    console.log(`\n🔍 比对 ${aiMsg.aiName} 的回答...`)
    aiMsg.content = highlightDuplicates(aiMsg.content, summaryMsg.content)
  })

  console.log(`\n✨ 总结与原始回答重复内容高亮完成`)
}

const highlightDuplicatesBetweenAIs = () => {
  console.log('🔍 开始检测AI间重复内容...')
  
  // 先清理所有AI回答中的 #ERROR# 标记
  messages.value.forEach(m => {
    if (m.aiKey && !m.isSummary && !m.isVerification && m.content) {
      m.content = cleanContent(m.content)
    }
  })
  
  const aiMessages = messages.value.filter(m => 
    m.aiKey && !m.isSummary && !m.isVerification && m.role === 'assistant' && m.content && m.content.trim().length > 30
  )
  
  console.log(`📊 找到 ${aiMessages.length} 个AI回答`)
  
  if (aiMessages.length < 2) {
    console.log('⚠️ AI回答数量不足2个，跳过高亮')
    return
  }

  let totalHighlights = 0

  for (let i = 0; i < aiMessages.length; i++) {
    for (let j = i + 1; j < aiMessages.length; j++) {
      const msg1 = aiMessages[i]
      const msg2 = aiMessages[j]

      console.log(`\n🔗 对比: ${msg1.aiName} vs ${msg2.aiName}`)

      // 提取纯文本用于智能比较（去除Markdown语法字符）
      const plainText1 = msg1.content.replace(/[#*_`\[\](){}\\$~^+=|<>-]/g, ' ').replace(/\s+/g, ' ')
      const plainText2 = msg2.content.replace(/[#*_`\[\](){}\\$~^+=|<>-]/g, ' ').replace(/\s+/g, ' ')

      const sentences1 = plainText1.split(/(?<=[。！？；])/).filter(s => s.trim().length > 8)
      
      sentences1.forEach(sentence => {
        const trimmedSentence = sentence.trim()
        if (trimmedSentence.length < 8) return

        // 提取关键词（只去除中文标点和停用词，保留空格和英文）
        const keywords = trimmedSentence
          .replace(/[了的在是这有和与或但而因所以，。！？；：""''（）《》【】、]/g, '')
          .trim()

        if (keywords.length < 6) return

        // 使用更长的搜索文本以提高准确性
        const searchLength = Math.min(keywords.length, 25)
        const searchText = keywords.slice(0, searchLength)

        if (plainText2.includes(searchText)) {
          // 在原始Markdown内容中使用正则表达式搜索（忽略大小写和特殊字符）
          try {
            const escapedSearch = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const regex = new RegExp(escapedSearch, 'i')
            
            const match1 = msg1.content.match(regex)
            const match2 = msg2.content.match(regex)

            if (match1 && match2) {
              let start1 = match1.index, end1 = match1.index + match1[0].length
              let start2 = match2.index, end2 = match2.index + match2[0].length

              // 扩展到完整句子（保留原始Markdown格式）
              while (start1 > 0 && !/[。！？；\n]/.test(msg1.content[start1 - 1])) start1--
              while (end1 < msg1.content.length && !/[。！？；\n]/.test(msg1.content[end1])) end1++
              
              while (start2 > 0 && !/[。！？；\n]/.test(msg2.content[start2 - 1])) start2--
              while (end2 < msg2.content.length && !/[。！？；\n]/.test(msg2.content[end2])) end2++

              const text1 = msg1.content.substring(start1, end1)
              const text2 = msg2.content.substring(start2, end2)

              // 提高阈值确保质量：至少15个字符
              if (text1.length >= 15 && text2.length >= 15) {
                // 防止重复标记和标记已处理的内容
                if (!text1.includes('<mark') && !text2.includes('<mark')) {
                msg1.content = msg1.content.substring(0, start1) +
                  `<mark class="ai-duplicate-highlight" title="与${msg2.aiName}的回答重复">${text1}</mark>` +
                  msg1.content.substring(end1)

                msg2.content = msg2.content.substring(0, start2) +
                  `<mark class="ai-duplicate-highlight" title="与${msg1.aiName}的回答重复">${text2}</mark>` +
                  msg2.content.substring(end2)
                
                totalHighlights++
                  console.log(`✅ 高亮成功: "${text1.substring(0, 35)}..." (${text1.length}字)`)
                }
              }
            }
          } catch (e) {
            console.warn('正则表达式错误:', e)
          }
        }
      })
    }
  }

  console.log(`\n✨ AI间重复内容高亮完成，共标记 ${totalHighlights} 处`)
}

const addSourceTagsToSummary = () => {
  console.log('🏷️ 开始添加总结来源标签...')
  
  // 先清理总结内容中的 #ERROR# 标记
  const summaryMsg = messages.value.find(m => m.isSummary && m.content)
  if (summaryMsg && summaryMsg.content) {
    summaryMsg.content = cleanContent(summaryMsg.content)
  }
  
  if (!summaryMsg || !summaryMsg.content) {
    console.log('⚠️ 未找到总结消息')
    return
  }

  const aiMessages = messages.value.filter(m => 
    m.aiKey && !m.isSummary && !m.isVerification && m.role === 'assistant' && m.content && m.content.trim().length > 30
  )
  
  console.log(`📊 找到 ${aiMessages.length} 个AI回答可用于来源标注`)
  
  if (aiMessages.length === 0) return

  let summaryWithSources = summaryMsg.content
  let totalSources = 0

  aiMessages.forEach(aiMsg => {
    console.log(`\n🔍 分析 ${aiMsg.aiName} 的回答...`)
    
    // 提取纯文本用于比较
    const plainAiText = aiMsg.content.replace(/[#*_`\[\](){}\\$~^+=|<>-]/g, ' ').replace(/\s+/g, ' ')
    const plainSummary = summaryWithSources.replace(/[#*_`\[\](){}\\$~^+=|<>-]/g, ' ').replace(/\s+/g, ' ')
    
    const sentences = plainAiText.split(/(?<=[。！？；])/).filter(s => s.trim().length > 10)

    sentences.forEach(sentence => {
      const trimmedSentence = sentence.trim()
      if (trimmedSentence.length < 10) return

      // 提取关键词（只去除中文标点和停用词，保留空格和英文）
      const keywords = trimmedSentence
        .replace(/[了的在是这有和与或但而因所以，。！？；：""''（）《》【】、]/g, '')
        .trim()

      if (keywords.length < 6) return

      // 使用更长的搜索文本
      const searchLength = Math.min(keywords.length, 20)
      const searchText = keywords.slice(0, searchLength)

      if (plainSummary.includes(searchText)) {
        // 在原始总结内容中使用正则表达式搜索
        try {
          const escapedSearch = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const regex = new RegExp(escapedSearch, 'i')
          const match = summaryWithSources.match(regex)
        
        if (match && match.index !== undefined) {
          let start = match.index, end = match.index + match[0].length

          // 扩展到完整句子
          while (start > 0 && !/[。！？；\n]/.test(summaryWithSources[start - 1])) start--
          while (end < summaryWithSources.length && !/[。！？；\n]/.test(summaryWithSources[end])) end++

          const textToMark = summaryWithSources.substring(start, end)
          
          // 提高阈值确保质量
          if (textToMark.length >= 12 && !textToMark.includes('<mark') && !textToMark.includes('source-tag')) {
            const sourceTag = `<span class="source-tag" style="background: ${aiMsg.color}; color: white; padding: 1px 6px; border-radius: 3px; font-size: 11px; margin-left: 4px;">${aiMsg.aiName}</span>`
            const markedText = `<mark class="source-highlight">${textToMark}${sourceTag}</mark>`
            summaryWithSources = summaryWithSources.substring(0, start) + markedText + summaryWithSources.substring(end)
            
            totalSources++
            console.log(`✅ 来源标注: "${textToMark.substring(0, 30)}..." ← ${aiMsg.aiName}`)
          }
        }
        } catch (e) {
          console.warn('正则表达式错误:', e)
        }
      }
    })
  })

  summaryMsg.content = summaryWithSources
  console.log(`\n🎯 总结来源标注完成，共标记 ${totalSources} 处`)
}

// ---------- 3.5 内容可疑度分析（检测普通问题中的幻觉）----------
const analyzeContentSuspicion = (content, userQuestion) => {
  let score = 0
  const text = content || ''

  // 1. 包含具体人名 + 详细生平（像编故事一样详细）
  if (/(姓名|名字|叫|名为|名叫|本名|原名)\s*[：:]\s*[\u4e00-\u9fa5]{2,4}/.test(text)) score += 1
  if (/(\d{4})年/.test(text) && /出生|生于|出生于|逝世|去世|卒于/.test(text)) score += 1

  // 2. 过于详细的个人描述（虚构人物常见特征）
  const detailPatterns = [
    /外貌特征.*?[\u4e00-\u9fa5]{20,}/,  // 详细外貌描写
    /性格(特点|标签|特质).*?[\u4e00-\u9fa5]{15,}/,  // 详细性格描述
    /(童年|少年|青年)时期.*?[\u4e00-\u9fa5]{20,}/,  // 详细成长经历
    /背景故事.*?[\u4e00-\u9fa5]{30,}/,  // 长篇背景故事
    /标志性(习惯|口头禅|动作).*?[：:]/,  // 虚构角色的标志性特征
  ]
  detailPatterns.forEach(p => { if (p.test(text)) score += 1 })

  // 3. 回答中包含"无法验证"的特定细节
  if (/(据说|传闻|据传|相传|坊间流传)/.test(text)) score += 0.5

  // 4. 问题问的是事实（谁/什么/哪里/何时），但回答像小说
  const factualQuestion = /^(谁是|什么是|哪里有|何时|哪年|哪个|多少|怎么).*(\?|？|吗)?$/.test(userQuestion.trim())
  if (factualQuestion && text.length > 300 && score >= 1) score += 1

  // 5. 包含过于具体的虚构细节（小数点数据、精确到日的日期等）
  if (/\d+\.\d+/.test(text) && /(米|公斤|厘米|毫米|秒|百分比|%)/.test(text)) score += 0.5

  return Math.min(score, 5)
}

// ---------- 3.6 内容清理函数 ----------
const cleanContent = (content) => {
  if (!content) return ''

  let cleaned = content
    .replace(/#ERROR#/g, '')

  cleaned = cleaned.replace(/\r\n/g, '\n')
  cleaned = cleaned.replace(/\r/g, '\n')
  cleaned = cleaned.replace(/\u0085/g, '\n')
  cleaned = cleaned.replace(/\u2028/g, '\n')

  // 🔧 修复：去除 Markdown 符号前的反斜杠转义（AI有时会转义 * _ 等）
// 注意：保留 LaTeX 命令（\frac, \Delta, \int 等），只处理 MD 符号
cleaned = cleaned.replace(/\\([*_~|`#])/g, '$1')

  // 🆕 智能修复：检测并修复英文单词间的缺失空格（针对GLM-4等模型的传输问题）
  // 仅在非 Markdown 语法字符后修复，避免破坏 **bold** 等格式
  cleaned = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2')  // 小写→大写：补空格
  cleaned = cleaned.replace(/(\w)(\.\d)/g, '$1 $2')      // 单词+数字序号：补空格

  // ✅ 只压缩空格和制表符，严格保留换行符！（Markdown 渲染依赖换行）
  cleaned = cleaned.replace(/[ \t]+/g, ' ')      // 压缩多个空格/Tab为一个空格

  // 🔑 核心修复：只去除首尾的空格/Tab，但严格保留换行符！
  // 原因：在流式传输中，每个 delta 末尾的 \n\n 是 Markdown 段落分隔的关键，
  // 如果被 trim() 删掉，会导致所有依赖换行的格式（标题/列表/表格/代码块）失效
  cleaned = cleaned.replace(/^[ \t]+/, '')       // 去除开头的空格/Tab
  cleaned = cleaned.replace(/[ \t]+$/, '')       // 去除末尾的空格/Tab

  return cleaned
}

// 🔑 最终渲染前的完整表格修复函数（在 md.render() 调用前使用）
const fixTableSyntax = (markdownText) => {
  if (!markdownText) return ''

  let fixed = markdownText

  // ============================================
  // 🔬 核心功能：智能重建单行表格为多行GFM表格
  // 解决GLM-5.1等模型返回的单行"伪表格"问题
  // ============================================
  fixed = rebuildSingleLineTables(fixed)

  // 1️⃣ 修复表格前的空行（标题和表格之间必须有空行）
  fixed = fixed.replace(/(#{1,6}\s.*[^\n])\n(\|)/g, '$1\n\n$2')

  // 2️⃣ 修复表格数据行的 | 符号周围空格（GFM表格要求）
  // 🔑 关键：跳过代码块（```）内的内容，且仅处理明确是表格行的行
  // 策略：逐行处理，只修复以 | 开头或包含 | 的非代码块行
  const lines = fixed.split('\n')
  let inCodeBlock = false
  const processedLines = lines.map((line) => {
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock
      return line
    }
    if (inCodeBlock) return line

    // 只处理表格行（包含 | 但不以 #>`*- 开头）
    if (line.includes('|') && !/^\s*(#|>|`|\*|\-|\d+\.)/.test(line.trimStart())) {
      // 判断是否为分隔符行（仅包含 |、-、:、空格）
      const isSeparatorRow = /^\|[\s\-:]+\|$/.test(line.trim())
      if (isSeparatorRow) {
        // 分隔符行：不移除 | 后面的空格，但确保 | 后紧跟 - 或 :
        // 修复被错误添加空格的分离符行
        return line.trim().replace(/\|\s+/g, '|').replace(/\s+\|/g, '|')
      }
      // 数据行：确保 | 两侧有空格（美观）
      let fixedLine = line.replace(/\|([^ \t\n\r])/g, '| $1')
      fixedLine = fixedLine.replace(/([^ \t\n\r])\|/g, '$1 |')
      return fixedLine
    }
    return line
  })
  fixed = processedLines.join('\n')

  // 3️⃣ 修复被拆分的表头单元格
  fixed = fixed.replace(/\|\s*\(([^)]+)\)\s*\|/g, ' ($1) |')

  // 4️⃣ 移除表格内多余空行
  fixed = fixed.replace(/(\|[^\n]+\|)\n+(?=\|)/g, '$1\n')

  return fixed
}

// 🔧 智能表格重建器：将单行伪表格转换为多行GFM表格
const rebuildSingleLineTables = (text) => {
  // 匹配模式：包含多个 || 或 |...| 的长行（可能是压缩的表格）
  // 特征：一行中有超过3个 | 且长度>50字符
  const lines = text.split('\n')
  const rebuiltLines = []
  let inCodeBlock = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 跟踪代码块状态
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock
      rebuiltLines.push(line)
      continue
    }
    if (inCodeBlock) {
      rebuiltLines.push(line)
      continue
    }

    const pipeCount = (line.match(/\|/g) || []).length

    // 判断是否为"压缩表格行"
    // 🔑 提高阈值：| 数量 >= 8 且 行长度 > 80，避免误判普通文本
    // 且排除以 #>`*- 开头的行（标题/引用/列表）
    const isCompressedTable = (
      pipeCount >= 8 &&
      line.length > 80 &&
      !line.trimStart().startsWith('```') &&
      !/^\s*(#|>|`|\*|\-|\d+\.)/.test(line.trimStart())
    )

    if (isCompressedTable) {
      console.log(`🔧 检测到压缩表格行 (${pipeCount}个|):`, line.substring(0, 80))

      // 尝试重建表格
      const rebuiltTable = attemptTableRebuild(line)
      if (rebuiltTable) {
        rebuiltLines.push(rebuiltTable)
        continue
      }
    }

    rebuiltLines.push(line)
  }

  return rebuiltLines.join('\n')
}

// 🛠️ 尝试重建单个压缩表格
const attemptTableRebuild = (compressedLine) => {
  // 步骤1：分割单元格（按 | 分割）
  let cells = compressedLine.split('|').map(cell => cell.trim()).filter(cell => cell !== '')

  if (cells.length < 3) {
    return null  // 单元格太少，可能不是表格
  }

  console.log(`   检测到 ${cells.length} 个单元格:`, cells.slice(0, 8).join(' | ') + '...')

  // 步骤2：尝试识别表头和数据行的分界点
  // 策略1：查找 :--- 模式（已存在的分隔符）
  const separatorIndex = cells.findIndex(cell =>
    /^[\s\-:]+$/.test(cell) && cell.includes('-')
  )

  let headerCells, dataRows

  if (separatorIndex !== -1) {
    // 已有分隔符，直接使用
    headerCells = cells.slice(0, separatorIndex)
    const dataCells = cells.slice(separatorIndex + 1)

    // 将剩余的数据单元格分成多行（每行 N 列，N=表头列数）
    dataRows = chunkArray(dataCells, headerCells.length)

    console.log(`   找到分隔符在第${separatorIndex + 1}位`)
    console.log(`   表头: ${headerCells.length}列, 数据: ${dataCells.length}个单元格`)
  } else {
    // 没有分隔符，需要智能判断表头和数据

    // 策略2：如果单元格数是偶数且>=6，假设一半是表头一半是数据
    if (cells.length >= 6 && cells.length % 2 === 0) {
      const half = Math.floor(cells.length / 2)
      headerCells = cells.slice(0, half)
      const dataCells = cells.slice(half)
      dataRows = chunkArray(dataCells, headerCells.length)

      console.log(`   无分隔符，均分: 表头${headerCells.length}列 + 数据`)
    } else {
      // 策略3：如果单元格很多（>10），取前几个作为表头
      if (cells.length > 10) {
        // 假设前3-5个是表头（常见的表格列数）
        const possibleColCounts = [3, 4, 5]
        let bestMatch = null

        for (const colCount of possibleColCounts) {
          if ((cells.length - colCount) % colCount === 0) {
            bestMatch = colCount
            break
          }
        }

        if (bestMatch) {
          headerCells = cells.slice(0, bestMatch)
          const dataCells = cells.slice(bestMatch)
          dataRows = chunkArray(dataCells, bestMatch)
          console.log(`   智能匹配: ${bestMatch}列表格`)
        } else {
          return null  // 无法确定列数
        }
      } else {
        return null  // 单元格数量不足
      }
    }
  }

  // 步骤3：构建标准GFM表格
  if (!headerCells || !dataRows || dataRows.length === 0) {
    return null
  }

  const separatorRow = headerCells.map(() => ':---').join(' | ')

  let tableMarkdown = [
    '| ' + headerCells.join(' | ') + ' |',
    '| ' + separatorRow + ' |',
    ...dataRows.map(row =>
      '| ' + row.map(cell => cell || '-').join(' | ') + ' |'
    )
  ].join('\n')

  console.log(`   ✅ 成功重建表格: ${dataRows.length + 2}行`)

  return tableMarkdown
}

// 工具函数：将数组按指定大小分块
const chunkArray = (arr, size) => {
  const chunks = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

// ---------- 4. 发送消息（核心并行逻辑） ----------
const sendMessage = async () => {
  if (!inputText.value.trim()) return
  if (loading.value) return

  // 重置验证状态
  verifying.value = false
  verifyResult.value = null
  verifyText.value = ''

  //  全自动模式：使用 GLM-5 AI 智能分析问题并选择模型
  if (chatMode.value === 'auto') {
    try {
      const autoModels = await autoAnalyzeQuestion(inputText.value)
      enabledAIs.value = autoModels
      needSummary.value = autoModels.length >= 2  //  只有≥2个AI才总结
    } catch (error) {
      console.error('自动分析失败:', error)
      enabledAIs.value = ['GLM5', 'openrouter']  // 使用默认组合
      needSummary.value = true  // 默认组合需要总结
    }
  }

  if (enabledAIs.value.length === 0) {
    showMenu.value = true  // 自动打开AI选择菜单
    return
  }

  hasStarted.value = true  // 标记为已开始对话，切换到聊天界面

  const userQuestion = inputText.value

  // ---------- 构建历史消息（保留最近10条，排除初始欢迎语） ----------
  const historyMessages = messages.value
    .filter(msg => !(msg.role === 'assistant' && msg.content === '选择AI后提问，他们会同时回答')) // 去掉欢迎语
    .slice(-15) // 只保留最近15条，防止token超限
    .map(msg => ({
      role: msg.role,
      content: msg.content
    }))

  // 添加用户消息
  messages.value.push({ role: 'user', content: userQuestion })
  inputText.value = ''
  loading.value = true
  await nextTick()
  chatBox.value.scrollTop = chatBox.value.scrollHeight

  // ---------- sendMessage 的核心请求部分 ----------

  // 为每个 AI 创建空的消息占位符（默认折叠）
  enabledAIs.value.forEach((key) => {
    const safeConfig = AI_CONFIGS[key] || { name: key, color: '#999' }
    const tempAiMessage = {
      role: 'assistant',
      aiName: safeConfig.name,
      content: '',
      color: safeConfig.color,
      aiKey: key,
      expanded: false,  // 默认折叠
      isSummary: false,  // 标记为普通消息
      isCompleted: false  // 是否完成回答（初始为false）
    }
    messages.value.push(tempAiMessage)
  })

  // 创建独立的总结消息占位符（初始隐藏）
  if (needSummary.value) {
    const summaryId = `summary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    messages.value.push({
      role: 'assistant',
      aiName: '综合总结',
      content: '',
      color: '#6C5CE7',
      isSummary: true,
      aiKey: summaryId,
      showSummary: false,       // 初始隐藏
      isGenerating: false        // 是否正在生成中
    })
    window.currentSummaryId = summaryId
  }

  try {
    console.log('发送的 enabledAIs:', enabledAIs.value)

    // 只发送一次请求，让后端并行处理所有 AI
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: userQuestion,
        enabledAIs: enabledAIs.value,
        history: historyMessages,  // 发送历史消息给后端
        needSummary: needSummary.value  // 是否需要总结
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`后端错误 ${response.status}: ${errText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      enabledAIs.value.forEach((key) => {
        const aiMessages = messages.value.filter(m => m.aiKey === key && m.role === 'assistant')
        const msg = aiMessages[aiMessages.length - 1]
        if (msg) msg.content = '❌ 无法读取流式响应'
      })
      loading.value = false
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let currentEvent = 'message'
    let closeReceived = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          const raw = line.slice(6).trim()
          if (!raw || raw === '{}') continue

          try {
            const data = JSON.parse(raw)

            if (currentEvent === 'delta') {
              console.log('delta 来了！', data.aiKey, data.content)
              // 找到最后一个该AI的空消息（而不是第一个，避免追加到旧消息）
              const aiMessages = messages.value.filter(m => m.aiKey === data.aiKey && m.role === 'assistant')
              const msg = aiMessages[aiMessages.length - 1] // 取最后一个
              if (msg) {
                const cleaned = cleanContent(data.content)
                if (data.content.includes('*') || data.content.includes('$') || data.content.includes('#')) {
                  console.log('🔤 含Markdown语法的delta:', JSON.stringify(data.content.substring(0, 100)))
                  console.log('🔤 cleanContent后:', JSON.stringify(cleaned.substring(0, 100)))
                }
                msg.content += cleaned
              } else {
                console.warn('找不到对应的 AI 消息对象：', data.aiKey)
              }
            } else if (currentEvent === 'summary_start') {
              console.log('🔄 开始生成总结')
              // 标记总结正在生成
              const summaryMsg = messages.value.find(m => m.isSummary && m.aiKey === window.currentSummaryId)
              if (summaryMsg) {
                summaryMsg.isGenerating = true
                console.log('✅ 总结消息标记为生成中')
              }
            } else if (currentEvent === 'summary_delta') {
              // 实时更新总结内容（即使隐藏也更新）
              const summaryMsg = messages.value.find(m => m.isSummary && m.aiKey === window.currentSummaryId)
              if (summaryMsg) {
                summaryMsg.content += cleanContent(data.content)
                // 不打印每个delta，避免控制台刷屏
              }
            } else if (currentEvent === 'summary_done') {
              console.log('✅ 总结流式输出完成，显示总结')
              // 总结生成完成，显示总结消息
              const summaryMsg = messages.value.find(m => m.isSummary && m.aiKey === window.currentSummaryId)
              if (summaryMsg) {
                summaryMsg.showSummary = true
                summaryMsg.isGenerating = false
                
                highlightDuplicatesBetweenAIs()
                highlightDuplicatesInOriginals()
                addSourceTagsToSummary()
                
                await nextTick()
                if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight
              }
            } else if (currentEvent === 'done') {
              console.log(`🎯 ${data.aiKey} 回答完成事件`)
              // 标记该AI回答完成
              const aiMessages = messages.value.filter(m => m.aiKey === data.aiKey && !m.isSummary)
              console.log(`找到 ${aiMessages.length} 个匹配的消息`)

              if (aiMessages.length > 0) {
                const aiMsg = aiMessages[aiMessages.length - 1]  // 取最后一个
                aiMsg.isCompleted = true
                console.log(`✅ ${data.aiKey} 已标记为完成，内容长度: ${aiMsg.content?.length || 0}`)

                // 如果当前轮次只有一个AI，回答完成后自动展开
                if (enabledAIs.value.length === 1) {
                  aiMsg.expanded = true
                  console.log('🔍 单AI模式，自动展开回答')
                }
              } else {
                console.warn(`⚠️ 找不到 ${data.aiKey} 的消息对象！`)
                console.log('当前所有消息:', messages.value.map(m => ({ aiKey: m.aiKey, isSummary: m.isSummary, role: m.role })))
              }
            } else if (currentEvent === 'error') {
              messages.value.push({
                role: 'assistant',
                aiName: data.aiKey || '未知AI',
                content: `❌ ${data.error}`,
                color: '#EF4444',
                aiKey: data.aiKey || 'unknown'
              })
            } else if (currentEvent === 'verify_start') {
              verifying.value = true
              verifyText.value = ''
              verifyResult.value = null
              console.log('🔍 开始验证回答真实性...')
            } else if (currentEvent === 'verify_delta') {
              verifyText.value += data.content
            } else if (currentEvent === 'verify_done') {
              verifying.value = false
              verifyResult.value = data
              console.log(`✅ 验证完成: ${data.hasHallucination ? '⚠️ 发现幻觉' : '✓ 未发现明显幻觉'}`)
              console.log('验证详情:', data)
              console.log('verifyText前200字:', verifyText.value.substring(0, 200))
              console.log('aiVerifications:', data.aiVerifications)

              // 🛡️ 前端兜底：基于规则的幻觉检测（不依赖验证AI的判断）
              const lastUserMsg = [...messages.value].reverse().find(m => m.role === 'user')
              const userQuestion = lastUserMsg?.content || ''

              // 检测是否为虚构/创作类请求（多维度匹配）
              const fictionPatterns = [
                // 直接关键词
                /虚构|编造|创造|想象|编一个|杜撰|臆造|凭空|发明一个/i,
                // 创作类
                /写(一个|一篇|一部)?(故事|小说|人物|角色|传记|生平)/i,
                /设计(一个)?(角色|人物|形象| persona)/i,
                /创造(一个)?(角色|人物|形象|世界|文明)/i,
                /构建(一个)?(虚拟|架空|想象)(的)?(世界|人物|角色|设定)/i,
                /编(写|造|撰)(一个)?(人物|角色|故事|经历|生平|简历)/i,
                // 隐晦表达
                /不存在的(人|人物|角色|国家|城市|组织|公司)/i,
                /凭空(创造|捏造|编造|想象)(的)?/i,
                /(假如|假设|如果).*(有个人|有个|存在一个).*叫/i,
                /给我(想|编|造|设计|创造)一个(人|名字|角色|人物|ID)/i,
                /扮演(一下)?.*(某个|一个|特定)(角色|人物|身份)/i,
                // 故事/小说相关
                /小说(里|中|的)?(主角|人物|角色|原型)/i,
                /故事(里|中)?(的)?(主人公|主角|人物)/i,
                /科幻(小说|故事|设定|世界观).(里|中|的)?(人物|角色)/i,
                // 其他
                /架空(历史|世界|人物|设定)/i,
                /原创(角色|人物|IP|形象|设定)/i,
                /自定义(角色|人物|形象|NPC)/i
              ]

              const isFictionRequest = fictionPatterns.some(p => p.test(userQuestion))

              // 将验证结果存到每个AI消息上
              messages.value.forEach(m => {
                if (m.aiKey && !m.isSummary && !m.isVerification) {
                  const key = m.aiKey
                  let status
                  let reason = ''

                  if (isFictionRequest) {
                    // 虚构请求 → 直接判定为幻觉（不问验证AI）
                    status = '幻觉'
                    reason = `用户要求"${userQuestion.substring(0, 30)}"，AI回答内容为虚构创作，非真实事实`
                    console.log(`规则检测: ${key} 回答了虚构请求 → 强制标记幻觉`)
                  } else {
                    // 非虚构请求 → 先用验证AI的结果
                    status = (data.aiVerifications && data.aiVerifications[key]) || '可信'

                    // 二次校验：即使验证AI说可信，也要检查内容是否可疑
                    if (status === '可信') {
                      const content = m.content || ''
                      const suspicionScore = analyzeContentSuspicion(content, userQuestion)

                      if (suspicionScore >= 3) {
                        status = '幻觉'
                        reason = `内容可疑度=${suspicionScore}/5：回答包含过多无法验证的具体细节，可能存在幻觉`
                        console.log(`二次校验: ${key} 内容可疑度=${suspicionScore} → 覆盖为幻觉`)
                      } else if (suspicionScore >= 2) {
                        status = '幻觉'
                        reason = `内容存疑（可疑度=${suspicionScore}/5）：建议谨慎参考\n\n${verifyText.value}`
                        console.log(`二次校验: ${key} 可疑度=${suspicionScore} → 标记存疑`)
                      }
                    }
                  }

                  console.log(`为 ${key} 设置验证状态: ${status}${reason ? ' | ' + reason : ''}`)
                  m.verificationStatus = status
                  m.verificationText = reason || verifyText.value
                  if (status === '幻觉') {
                    m.hasHallucination = true
                  }
                }
              })
            } else if (currentEvent === 'close') {

              closeReceived = true
              loading.value = false
              console.log('✅ 收到 close 事件，关闭 loading')

              // 🛡️ 保障逻辑：将所有未完成的 AI 强制标记为完成
              const incompleteAIs = messages.value.filter(m => m.aiKey && !m.isSummary && !m.isVerification && !m.isCompleted)
              if (incompleteAIs.length > 0) {
                console.log(`🛡️ 发现 ${incompleteAIs.length} 个未完成的 AI，强制标记为完成:`)
                incompleteAIs.forEach(ai => {
                  ai.isCompleted = true
                  console.log(`  ✅ ${ai.aiName} (${ai.aiKey}) 已强制完成`)
                })
              }

              // 如果当前轮次只有一个AI，强制完成后也自动展开
              if (enabledAIs.value.length === 1) {
                const singleAI = messages.value.find(m => m.aiKey && !m.isSummary && !m.expanded)
                if (singleAI) {
                  singleAI.expanded = true
                  console.log('🔍 单AI模式，close事件自动展开回答')
                }
              }

              // 所有AI回答完成，检查是否需要显示总结
              const summaryMsg = messages.value.find(m => m.isSummary && m.aiKey === window.currentSummaryId)
              if (summaryMsg && !summaryMsg.showSummary) {
                // 如果总结还没显示（可能没收到summary_done），强制显示
                if (summaryMsg.content.length > 0) {
                  summaryMsg.showSummary = true
                  console.log('强制显示综合总结（close事件触发）')
                }
                summaryMsg.isGenerating = false
              }

              await nextTick()
            }
          } catch (e) {
            // 忽略非 JSON 数据
          }
        }
      }

      await nextTick()
      if (chatBox.value) {
        chatBox.value.scrollTop = chatBox.scrollHeight
      }
    }

    if (!closeReceived) {
      console.warn('⚠️ 流结束但未收到 close 事件，强制关闭 loading')
      loading.value = false

      // 强制关闭时也显示总结
      const summaryMsg = messages.value.find(m => m.isSummary && m.aiKey === window.currentSummaryId)
      if (summaryMsg) {
        summaryMsg.showSummary = true
        
        console.log('🔄 强制关闭模式：执行高亮处理')
        highlightDuplicatesBetweenAIs()
        highlightDuplicatesInOriginals()
        addSourceTagsToSummary()
      }
    }
  } catch (error) {
    console.error('请求后端失败:', error)
    messages.value.push({
      role: 'assistant',
      aiName: '系统',
      content: `❌ 连接后端失败：${error.message}。请确保后端已启动（npm run dev）`,
      color: '#EF4444'
    })
    loading.value = false
  }
}
</script>

<style>
@import './styles/chat.css';
</style>