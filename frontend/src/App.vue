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
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
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


const AI_CONFIGS = {
  zhipu: {
    name: '智谱GLM',
    url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    key: import.meta.env.VITE_ZHIPU_KEY,
    model: 'glm-4-flash',
    color: '#6C5CE7' // 紫色
  },
  deepseek: {
    name: 'Ling',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: import.meta.env.VITE_OPENROUTER_KEY,
    model: 'inclusionai/ling-3.0-flash:free',
    color: '#1890FF' // 蓝色
  },
  openrouter: {
    name: 'GPT-OSS-20B',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: import.meta.env.VITE_OPENROUTER_KEY,
    model: 'openai/gpt-oss-20b:free',
    color: '#00B894' // 绿色
  },
  Gemma: {
    name: 'Gemma-4-26B',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: import.meta.env.VITE_OPENROUTER_KEY,
    model: 'google/gemma-4-26b-a4b-it:free',
    color: '#FFC107' // 黄色
  },
  Poolside: {
    name: 'Laguna S 2.1',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: import.meta.env.VITE_OPENROUTER_KEY,
    model: 'poolside/laguna-s-2.1:free',
    color: '#FF69B4' // 粉色
  },
  nvidia: {
    name: 'Nemotron 3 Ultra 550B',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: import.meta.env.VITE_OPENROUTER_KEY,
    model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    color: '#FFA500' // 橙色
  },
}




// ---------- 2. 状态变量 ----------
const messages = ref([
  { role: 'assistant', aiName: '', content: '选择AI后提问，他们会同时回答', color: '#999' }
])
const inputText = ref('')
const loading = ref(false)
const chatBox = ref(null)


const enabledAIs = ref(['zhipu', 'deepseek'])

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

  const totalAI = enabledAIs.value.length
  let finishedCount = 0

  // 辅助函数：检查是否所有 AI 都处理完了
  const checkLoadingDone = () => {
    if (finishedCount === totalAI) {
      loading.value = false
    }
  }

  await nextTick()
  chatBox.value.scrollTop = chatBox.value.scrollHeight

  // ---------- 核心：每个 AI 独立请求，带超时控制 ----------
  enabledAIs.value.forEach(async (key) => {
    const config = AI_CONFIGS[key]

    // 1. 检查密钥
    if (!config.key) {
      messages.value.push({
        role: 'assistant',
        aiName: config.name,
        content: '❌ 未配置密钥',
        color: config.color
      })
      finishedCount++
      checkLoadingDone()
      return
    }

    // 2. 创建 AbortController，设置 15 秒超时
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.key}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: '请用中文回答。行内公式请用 $...$ 包裹，块级公式请用 $$...$$ 包裹。' },
            ...historyMessages,
            { role: 'user', content: userQuestion }
          ]
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const rawText = await response.text()
      let data = null
      try { data = rawText ? JSON.parse(rawText) : null } catch (e) { data = null }
      console.log(`[AI:${config.name}] status=${response.status}`, data || rawText)

      if (!response.ok) {
        messages.value.push({
          role: 'assistant',
          aiName: config.name,
          content: `❌ ${response.status} ${rawText}`,
          color: config.color
        })
      } else {
        const reply = (data?.choices?.[0]?.message?.content || data?.result || data?.output?.[0]?.content || rawText || '').toString().trim()
        messages.value.push({
          role: 'assistant',
          aiName: config.name,
          content: reply || '⚠️ 返回内容为空',
          color: config.color
        })
      }
    } catch (error) {
      let errorMsg = '请求失败'
      if (error.name === 'AbortError') {
        errorMsg = '⏰ 请求超时（超过15秒），请稍后重试'
      } else {
        errorMsg = `❌ 网络错误：${error.message}`
      }
      messages.value.push({
        role: 'assistant',
        aiName: config.name,
        content: errorMsg,
        color: config.color
      })
    } finally {
      finishedCount++
      clearTimeout(timeoutId)
      await nextTick()
      chatBox.value.scrollTop = chatBox.value.scrollHeight
      checkLoadingDone()
    }
  })
}
</script>

<style>
@import './styles/chat.css';
</style>
