<template>
  <div class="chat-container">
    <img src="/MullenMuse.svg" alt="MullenMuse" class="logo" />

    <div class="top-nav">
      <div class="nav-divider" aria-hidden="true"></div>
      <a class="made-by" href="https://stackovate.github.io" target="_blank" rel="noopener noreferrer">Made by STACKOVATE Studio</a>
    </div>

    <div class="chat-box">
      <div v-for="(msg, index) in messages" :key="index" class="message-wrapper">
        <!-- 用户消息 -->
        <div v-if="msg.role === 'user'" class="message user-message">
          <div class="bubble user-bubble">{{ msg.content }}</div>
        </div>
        <!-- AI消息（带标签） -->
        <div v-else class="message ai-message">
          <div class="bubble ai-bubble">
            <span class="ai-tag" :style="{ background: msg.color || '#409EFF' }">{{ msg.aiName }}</span>
            {{ msg.content }}
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

      <input 
        v-model="inputText" 
        placeholder="输入你的问题..." 
        @keyup.enter="sendMessage"
        :disabled="loading || enabledAIs.length === 0"
        class="chat-input"
      />
      <button @click="sendMessage" :disabled="loading || enabledAIs.length === 0" class="send-btn">
        {{ loading ? '发送中' : '发送' }}
      </button>
    </div>
    <div class="disclaimer">内容由AI生成，请仔细甄别。</div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'

// ---------- 1. AI配置中心（在这里加新AI） ----------
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
  }
}

// ---------- 2. 状态变量 ----------
const messages = ref([
  { role: 'assistant', aiName: '', content: '选择AI后提问，他们会同时回答', color: '#999' }
])
const inputText = ref('')
const loading = ref(false)
const chatBox = ref(null)

// 默认勾选前两个（智谱和DeepSeek），你也可以全选
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
  // 添加用户消息
  messages.value.push({ role: 'user', content: userQuestion })
  inputText.value = ''
  loading.value = true
  await nextTick()
  chatBox.value.scrollTop = chatBox.value.scrollHeight

  // 构建并行请求任务列表（增强：检查 HTTP 状态、记录原始响应并改善空返回处理）
  const tasks = enabledAIs.value.map(async (key) => {
    const config = AI_CONFIGS[key]
    if (!config.key) {
      return {
        success: false,
        aiName: config.name,
        content: '❌ 未配置密钥，请在.env中设置',
        color: config.color
      }
    }
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
            { role: 'system', content: '请用中文简洁回答。' },
            { role: 'user', content: userQuestion }
          ]
        })
      })

      // 读取原始文本以便兼容不同提供方的返回格式，并记录以便调试
      const rawText = await response.text()
      let data = null
      try { data = rawText ? JSON.parse(rawText) : null } catch (e) { data = null }
      console.log(`[AI:${config.name}] status=${response.status}`, data || rawText)

      if (!response.ok) {
        // 返回非 2xx，直接作为失败信息返回
        return {
          success: false,
          aiName: config.name,
          content: `❌ ${response.status} ${rawText}`,
          color: config.color
        }
      }

      // 支持多种可能的响应字段，同时优先取非空字符串
      const reply = (data?.choices?.[0]?.message?.content || data?.result || data?.output?.[0]?.content || rawText || '').toString().trim()
      return {
        success: true,
        aiName: config.name,
        content: reply || '⚠️ 返回内容为空',
        color: config.color
      }
    } catch (error) {
      return {
        success: false,
        aiName: config.name,
        content: `❌ 请求失败：${error.message}`,
        color: config.color
      }
    }
  })

  // 关键：Promise.allSettled 让所有请求同时进行，互不等待
  const results = await Promise.allSettled(tasks)

  // 收集所有AI的回复（按顺序添加）
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      const data = result.value
      messages.value.push({
        role: 'assistant',
        aiName: data.aiName,
        content: data.content,
        color: data.color
      })
    } else {
      // 理论上不会走到这里，因为内部已catch
      messages.value.push({
        role: 'assistant',
        aiName: '未知AI',
        content: '❌ 未知错误',
        color: '#999'
      })
    }
  })

  loading.value = false
  await nextTick()
  chatBox.value.scrollTop = chatBox.value.scrollHeight
}
</script>

<style scoped>
@import './styles/chat.css';
</style>
