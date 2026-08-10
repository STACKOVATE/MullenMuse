<template>
  <div class="chat-container">

    <!-- 顶部导航栏 -->
    <header class="top-header">
      <div class="header-left">
        <img src="/MullenMuse.svg" alt="MullenMuse" class="header-logo" />
      </div>
      <div class="header-right">
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
        <div v-if="!hasStarted && messages.length <= 1" class="welcome-screen" key="welcome">
          <div class="welcome-content">
            <div class="welcome-icon">
              <Icon icon="lucide:bot-message-square" :width="48" :height="48" />
            </div>
            <h2 class="welcome-title">选择AI后提问，他们会同时回答</h2>

            <!-- 居中的输入框 -->
            <div class="welcome-input-area">
              <button class="select-ai-btn welcome-select-btn" @click.stop.prevent="toggleMenu" title="选择AI">
                <Icon icon="lucide:plus" :width="18" :height="18" />
              </button>
              <textarea v-model="inputText" placeholder="输入你的问题..." @keyup.enter.exact="sendMessage" @keydown.enter.shift.exact.prevent="inputText += '\n'" @input="autoResizeTextarea" :disabled="loading"
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
            <p class="welcome-disclaimer">内容由AI生成，请仔细甄别</p>
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
            <div v-else-if="!msg.isSummary && msg.aiKey" class="message ai-message accordion-message">
              <div class="accordion-item" :class="{ expanded: msg.expanded }">
                <!-- 折叠面板标题栏 -->
                <div class="accordion-header" @click="toggleCollapse(index)">
                  <Icon icon="lucide:bot" :width="16" :height="16" class="accordion-icon" />
                  <span class="ai-tag" :style="{ background: msg.color || '#409EFF' }">
                    {{ msg.aiName }}
                  </span>
                  <span class="accordion-status" :class="{ 'status-completed': msg.isCompleted && msg.expanded }">
                    <template v-if="msg.isCompleted && msg.expanded">✓ 回答完成</template>
                    <template v-else-if="msg.content.length > 0">已生成 {{ msg.content.length }} 字</template>
                    <template v-else>正在回答...</template>
                  </span>
                  <Icon :icon="msg.expanded ? 'lucide:chevron-down' : 'lucide:chevron-right'" :width="16" :height="16"
                    class="accordion-arrow" />
                </div>

                <!-- 折叠面板内容区 -->
                <transition name="accordion">
                  <div v-show="msg.expanded" class="accordion-content">
                    <span class="markdown-body" v-html="sanitize(md.render(fixTableSyntax(msg.content)))"></span>
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
                <div v-else-if="msg.content" class="summary-content-wrapper" v-html="sanitize(md.render(fixTableSyntax(msg.content)))">
                </div>
              </div>
            </div>
          </div>
          <!-- 加载状态 -->
          <div v-if="loading" class="loading-text">
            正在同时询问 {{ enabledAIs.length }} 个AI，请稍候...
          </div>
        </div>
      </transition>
    </main>

    <!-- 底部输入栏 - 只在对话状态显示 -->
    <footer v-if="hasStarted || messages.length > 1" class="bottom-bar">
      <div class="input-area-new">
        <!-- 左侧：选择AI按钮 -->
        <button class="select-ai-btn" @click.stop="toggleMenu" title="选择AI">
          <Icon icon="lucide:plus" :width="18" :height="18" />
        </button>

        <!-- 中间：输入框 -->
        <div class="input-wrapper">
          <textarea v-model="inputText" placeholder="输入你的问题..." @keyup.enter.exact="sendMessage" @keydown.enter.shift.exact.prevent="inputText += '\n'" @input="autoResizeTextarea" :disabled="loading"
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
                   'a', 'span', 'div', 'mark', 'sup', 'sub'],
    // 允许使用的HTML属性列表
    ALLOWED_ATTR: ['href', 'target', 'class', 'id', 'style', 'title']
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
const chatBox = ref(null)
const needSummary = ref(true)  // 自动启用总结功能
const hasStarted = ref(false)  // 是否已开始对话（用于切换界面）

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
  if (confirm('确定要清空所有聊天记录吗？')) {
    messages.value = [...defaultMessages]
    localStorage.removeItem('chatMessages')
    hasStarted.value = false  // 重置为初始状态，回到欢迎界面
    inputText.value = ''  // 清空输入框
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

// 🆕 自动调整 textarea 高度（智能版 - 支持增大和缩小 + 平滑动画）
const autoResizeTextarea = (event) => {
  const textarea = event.target
  if (!textarea || textarea.tagName !== 'TEXTAREA') return

  // 获取当前样式
  const computedStyle = getComputedStyle(textarea)
  const minHeight = parseFloat(computedStyle.minHeight) || 38
  const maxHeight = parseFloat(computedStyle.maxHeight) || 120

  // 保存当前高度用于比较
  const currentHeight = parseFloat(textarea.style.height) || minHeight

  // 🔑 第一步：临时设置为 auto，让浏览器自动计算实际需要的尺寸
  textarea.style.height = 'auto'

  // 强制浏览器重绘，确保 scrollHeight 准确
  void textarea.offsetHeight

  // 获取真实的 scrollHeight（此时是最准确的）
  let scrollHeight = textarea.scrollHeight

  // 🎯 精确修正：去除可能的额外空间（浏览器兼容性处理）
  const paddingTop = parseFloat(computedStyle.paddingTop) || 0
  const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0
  const borderTop = parseFloat(computedStyle.borderTopWidth) || 0
  const borderBottom = parseFloat(computedStyle.borderBottomWidth) || 0

  // 计算内容实际高度（减去 padding 和 border）
  const contentAreaHeight = scrollHeight - paddingTop - paddingBottom - borderTop - borderBottom

  // 如果内容很少或为空，直接使用最小高度
  if (contentAreaHeight <= minHeight * 0.8 || !textarea.value.trim()) {
    scrollHeight = minHeight
  }

  // 计算最终高度：限制在 min 和 max 之间
  let finalHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)

  // 四舍五入避免微小像素差异导致的抖动
  finalHeight = Math.round(finalHeight)

  // ✨ 第二步：使用双帧技术实现平滑过渡动画
  if (Math.abs(currentHeight - finalHeight) > 1) {
    // 先回到原始高度（触发起始状态）
    textarea.style.height = currentHeight + 'px'

    // 强制重绘，确保浏览器记录了起始状态
    void textarea.offsetHeight

    // 在下一帧设置目标高度（触发 CSS 过渡动画）
    requestAnimationFrame(() => {
      textarea.style.height = finalHeight + 'px'
    })
  } else {
    // 高度变化很小（< 1px），直接设置，避免不必要的动画
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
})

// 汉堡菜单状态
const showMenu = ref(false)
const menuRef = ref(null)
const welcomeMenuRef = ref(null)

const toggleMenu = () => { showMenu.value = !showMenu.value }

const toggleAI = (key) => {
  const index = enabledAIs.value.indexOf(key)
  if (index > -1) {
    enabledAIs.value.splice(index, 1)
  } else {
    enabledAIs.value.push(key)
  }
}

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

  const summarySentences = summary.split(/(?<=[。！？；\n])/).filter(s => s.trim().length > 5)

  let highlightedContent = originalContent

  summarySentences.forEach(sentence => {
    const trimmedSentence = sentence.trim()
    if (trimmedSentence.length < 5) return

    const keywords = trimmedSentence
      .replace(/[的了吗呢吧啊呀嘛么着过被把让向对从在到和与或但而因所以如果虽然即使]/g, '')
      .trim()

    if (keywords.length < 4) return

    const minLength = Math.min(keywords.length, 8)
    const index = highlightedContent.indexOf(keywords.slice(0, minLength))

    if (index !== -1) {
      let start = index
      let end = index + minLength

      while (start > 0 && !/[。！？；\n]/.test(highlightedContent[start - 1])) {
        start--
      }

      while (end < highlightedContent.length && !/[。！？；\n]/.test(highlightedContent[end])) {
        end++
      }

      const textToHighlight = highlightedContent.substring(start, end)
      if (textToHighlight.length >= 6) {
        const highlightedText = `<mark class="duplicate-highlight">${textToHighlight}</mark>`
        highlightedContent = highlightedContent.substring(0, start) + highlightedText + highlightedContent.substring(end)
      }
    }
  })

  return highlightedContent
}

const highlightDuplicatesBetweenAIs = () => {
  console.log('🔍 开始检测AI间重复内容...')
  
  // 先清理所有AI回答中的 #ERROR# 标记
  messages.value.forEach(m => {
    if (m.aiKey && !m.isSummary && m.content) {
      m.content = cleanContent(m.content)
    }
  })
  
  const aiMessages = messages.value.filter(m => 
    m.aiKey && !m.isSummary && m.role === 'assistant' && m.content && m.content.trim().length > 30
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
    m.aiKey && !m.isSummary && m.role === 'assistant' && m.content && m.content.trim().length > 30
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

// ---------- 3.5 内容清理函数 ----------
const cleanContent = (content) => {
  if (!content) return ''

  let cleaned = content
    .replace(/#ERROR#/g, '')                    // 移除 #ERROR# 标记

  // 🔧 关键修复：统一换行符格式（兼容 Windows/Mac/Unix）
  cleaned = cleaned.replace(/\r\n/g, '\n')      // Windows: CRLF → LF
  cleaned = cleaned.replace(/\r/g, '\n')        // 旧 Mac: CR → LF
  cleaned = cleaned.replace(/\u0085/g, '\n')    // Unicode NEL → LF
  cleaned = cleaned.replace(/\u2028/g, '\n')    // Unicode 行分隔符 → LF

  // 🆕 智能修复：检测并修复英文单词间的缺失空格（针对GLM-4等模型的传输问题）
  cleaned = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2')  // 小写→大写：补空格
  cleaned = cleaned.replace(/(\w)(\.\d)/g, '$1 $2')     // 单词+数字序号：补空格（如"1."前）

  // ✅ 只压缩空格和制表符，严格保留换行符！（Markdown 渲染依赖换行）
  cleaned = cleaned.replace(/[ \t]+/g, ' ')      // 压缩多个空格/Tab为一个空格

  // ============================================
  // ⚠️ 注意：不在流式传输过程中修改表格语法！
  // 表格修复应该在最终渲染时进行，而不是在每个delta中
  // ============================================

  return cleaned.trim()
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

  // 2️⃣ 修复表格行的 | 符号周围空格（GFM表格要求）
  fixed = fixed.replace(/\|([^ \t\n\r])/g, '| $1')
  fixed = fixed.replace(/([^ \t\n\r])\|/g, '$1 |')

  // 3️⃣ 修复被拆分的表头单元格
  fixed = fixed.replace(/\|\s*\(([^)]+)\)\s*\|/g, ' ($1) |')

  // 4️⃣ 规范化分隔符行
  fixed = fixed.replace(/^\|[\s\-:]+\|$/gm, (match) => {
    const cells = match.split('|').filter(c => c.trim())
    if (cells.length > 0) {
      return '|' + cells.map(() => ' :--- ').join('|') + '|'
    }
    return match
  })

  // 5️⃣ 移除表格内多余空行
  fixed = fixed.replace(/(\|[^\n]+\|)\n+(?=\|)/g, '$1\n')

  return fixed
}

// 🔧 智能表格重建器：将单行伪表格转换为多行GFM表格
const rebuildSingleLineTables = (text) => {
  // 匹配模式：包含多个 || 或 |...| 的长行（可能是压缩的表格）
  // 特征：一行中有超过3个 | 且长度>50字符
  const lines = text.split('\n')
  const rebuiltLines = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const pipeCount = (line.match(/\|/g) || []).length

    // 判断是否为"压缩表格行"
    // 条件：| 数量 >= 6 且 行长度 > 60 且 不包含代码块标记
    const isCompressedTable = (
      pipeCount >= 6 &&
      line.length > 60 &&
      !line.startsWith('```') &&
      !line.trim().startsWith('>')
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
                msg.content += cleanContent(data.content)
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
                addSourceTagsToSummary()
                
                await nextTick()
                scrollToBottom()
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
            } else if (currentEvent === 'close') {

              loading.value = false
              console.log('✅ 收到 close 事件，关闭 loading')

              // 🛡️ 保障逻辑：将所有未完成的 AI 强制标记为完成
              const incompleteAIs = messages.value.filter(m => m.aiKey && !m.isSummary && !m.isCompleted)
              if (incompleteAIs.length > 0) {
                console.log(`🛡️ 发现 ${incompleteAIs.length} 个未完成的 AI，强制标记为完成:`)
                incompleteAIs.forEach(ai => {
                  ai.isCompleted = true
                  console.log(`  ✅ ${ai.aiName} (${ai.aiKey}) 已强制完成`)
                })
              }

              // 所有AI回答完成，检查是否需要显示总结
              const summaryMsg = messages.value.find(m => m.isSummary && m.aiKey === window.currentSummaryId)
              if (summaryMsg && !summaryMsg.showSummary) {
                // 如果总结还没显示（可能没收到summary_done），强制显示
                if (summaryMsg.content.length > 0) {
                  summaryMsg.showSummary = true
                  console.log('✅ 强制显示综合总结（close事件触发）')
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