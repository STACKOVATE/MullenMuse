<template>
  <div class="chat-container">
    <img src="/MullenMuse.svg" alt="MullenMuse" class="logo" />

    <div class="top-nav">
      <div class="nav-divider" aria-hidden="true"></div>
      <a class="made-by" href="https://stackovate.github.io" target="_blank" rel="noopener noreferrer">Made by
        STACKOVATE Studio</a>
    </div>

    <div class="chat-box" ref="chatBox">
      <div v-for="(msg, index) in messages" :key="index" class="message-wrapper">
        <!-- 用户消息 -->
        <div v-if="msg.role === 'user'" class="message user-message">
          <div class="bubble user-bubble">{{ msg.content }}</div>
        </div>
        <!-- AI消息（带标签） -->
        <div v-else class="message ai-message">
          <div class="bubble ai-bubble">
            <span class="ai-tag" :style="{ background: msg.color || '#409EFF' }">
              {{ msg.aiName }}
            </span>
            <!-- 关键改动：用 v-html 渲染 Markdown，保留标签样式 -->
            <span class="markdown-body" v-html="sanitize(md.render(msg.content))"></span>
          </div>
        </div>
      </div>
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-text">
        正在同时询问 {{ enabledAIs.length }} 个AI，请稍候...
      </div>
    </div>

    <div class="input-area">
      <button class="hamburger-btn" @click.stop="toggleMenu" aria-label="选择AI">
        ☰
      </button>
      <div class="hamburger-menu" v-if="showMenu" ref="menuRef">
        <div class="menu-title">启用 AI</div>
        <div class="menu-list">
          <label v-for="(config, key) in AI_CONFIGS" :key="key" class="menu-item">
            <input type="checkbox" v-model="enabledAIs" :value="key" />
            <span class="menu-item-name">{{ config.name }}</span>
          </label>
        </div>
      </div>

      <input v-model="inputText" placeholder="输入你的问题..." @keyup.enter="sendMessage"
        :disabled="loading || enabledAIs.length === 0" class="chat-input" />
      <button @click="sendMessage" :disabled="loading || enabledAIs.length === 0" class="send-btn">
        {{ loading ? '发送中' : '发送' }}
      </button>
    </div>
    <div class="disclaimer">内容由AI生成，请仔细甄别。</div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import texmath from 'markdown-it-texmath'
import katex from 'katex'
import 'katex/dist/katex.min.css'  // 引入 KaTeX 样式
import DOMPurify from 'dompurify'

const sanitize = (html) => {
  return DOMPurify.sanitize(html)
}

// 创建 markdown-it 实例，启用数学插件
const md = new MarkdownIt()
  .use(texmath, {
    engine: katex,
    delimiters: ['dollars', 'display'],
    // 支持 $...$ 行内公式 和 $$...$$ 块级公式
  })




// ---------- 1. AI配置中心（在这里加新AI） ----------


/**
新名字: {
  name: '显示名称',
  url: 'https://openrouter.ai/api/v1/chat/completions',  
  key: import.meta.env.VITE_OPENROUTER_KEY,
  model: '厂商/模型名:free',  
  color: '#颜色代码'
}
 */


// 这个只用来显示，不包含密钥
const AI_CONFIGS = {
  zhipu: { name: 'GLM-4-flash', color: '#6C5CE7' },
  ling: { name: 'Ling', color: '#1890FF' },
  openrouter: { name: 'GLM-5', color: '#00B894' },
  Gemma: { name: 'Gemma-4-26B', color: '#FFC107' },
  Poolside: { name: 'Laguna S 2.1', color: '#FF69B4' },
  nvidia: { name: 'Nemotron 3 Ultra 550B', color: '#FFA500' }
}




// ---------- 2. 状态变量 ----------
const messages = ref([
  { role: 'assistant', aiName: '', content: '选择AI后提问，他们会同时回答', color: '#999' }
])
const inputText = ref('')
const loading = ref(false)
const chatBox = ref(null)


// 从 localStorage 恢复用户选择，默认启用 zhipu 和 ling
const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('enabledAIs') : null
const enabledAIs = ref(saved ? JSON.parse(saved) : ['zhipu', 'ling'])

// 持久化用户的勾选到 localStorage
watch(enabledAIs, (v) => {
  try {
    localStorage.setItem('enabledAIs', JSON.stringify(v))
  } catch (e) {
    // ignore
  }
}, { deep: true })

// 汉堡菜单状态
const showMenu = ref(false)
const menuRef = ref(null)

const toggleMenu = () => { showMenu.value = !showMenu.value }

const onDocClick = (e) => {
  if (!menuRef.value) return
  if (!menuRef.value.contains(e.target)) showMenu.value = false
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

// ---------- 3. 发送消息（核心并行逻辑） ----------
const sendMessage = async () => {
  if (!inputText.value.trim()) return
  if (loading.value) return
  if (enabledAIs.value.length === 0) {
    alert('请至少勾选一个AI！')
    return
  }
  
  const userQuestion = inputText.value

  // ---------- 构建历史消息（保留最近10条，排除初始欢迎语） ----------
  const historyMessages = messages.value
    .filter(msg => !(msg.role === 'assistant' && msg.content === '选择AI后提问，他们会同时回答')) // 去掉欢迎语
    .slice(-10) // 只保留最近10条，防止token超限
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

  // 为每个 AI 创建空的消息占位符
  enabledAIs.value.forEach((key) => {
    const safeConfig = AI_CONFIGS[key] || { name: key, color: '#999' }
    const tempAiMessage = {
      role: 'assistant',
      aiName: safeConfig.name,
      content: '',
      color: safeConfig.color,
      aiKey: key
    }
    messages.value.push(tempAiMessage)
  })

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
        enabledAIs: enabledAIs.value
      })
    })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`后端错误 ${response.status}: ${errText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        enabledAIs.value.forEach((key) => {
          const msg = messages.value.find(m => m.aiKey === key && m.role === 'assistant')
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
                console.log('delta 来了！', data.aiKey, data.content) //这行就是你要加的日志
                const msg = messages.value.find(m => m.aiKey === data.aiKey && m.role === 'assistant')
                if (msg) {
                  msg.content += data.content
                } else {
                  console.warn('找不到对应的 AI 消息对象：', data.aiKey) // 加一个警告，以防万一
                }
              } else if (currentEvent === 'done') {
                console.log(`${data.aiKey} 已完成`)
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