<template>
  <div class="chat-container">
    <h1 style="text-align:center; color:#409EFF;">MullMuse</h1>

    <div class="chat-box">
      <div v-for="(msg, index) in messages" :key="index" class="message-wrapper">
        <div v-if="msg.role === 'user'" class="message user-message">
          <div class="bubble user-bubble">{{ msg.content }}</div>
        </div>
        <div v-else class="message ai-message">
          <div class="bubble ai-bubble">{{ msg.content }}</div>
        </div>
      </div>
      <div v-if="loading" class="loading-text">AI正在思考...</div>
    </div>

    <div class="input-area">
      <input 
        v-model="inputText" 
        placeholder="输入你的问题..." 
        @keyup.enter="sendMessage"
        :disabled="loading"
        class="chat-input"
      />
      <button @click="sendMessage" :disabled="loading" class="send-btn">
        {{ loading ? '发送中' : '发送' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
// 从环境变量读取密钥（安全！）
const ZHIPU_API_KEY = import.meta.env.VITE_ZHIPU_KEY

const messages = ref([
  { role: 'assistant', content: '你好！我是 MullMuse，基于智谱AI，有什么可以帮你的？' }
])
const inputText = ref('')
const loading = ref(false)

const sendMessage = async () => {
  if (!inputText.value.trim()) return
  if (loading.value) return
  if (!ZHIPU_API_KEY) {
    messages.value.push({
      role: 'assistant',
      content: '🚫 未找到智谱AI密钥，请在 frontend/.env 中设置 VITE_ZHIPU_KEY 并重启开发服务器。'
    })
    return
  }

  // 添加用户消息
  messages.value.push({ role: 'user', content: inputText.value })
  const userQuestion = inputText.value
  inputText.value = ''
  loading.value = true

  try {
    // 调用智谱 AI 的 API（和 OpenAI 格式一样）
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZHIPU_API_KEY}`
      },
      body: JSON.stringify({
        model: 'glm-4-flash', // 便宜、速度快，适合练手
        messages: [
          { role: 'system', content: '你是一个友好的AI助手。' },
          ...messages.value.filter(m => m.role !== 'assistant' || m.content !== messages.value[0]?.content) // 简单处理上下文
        ]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`请求失败 ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    
    // 智谱AI返回的数据结构：data.choices[0].message.content
    const reply = data.choices?.[0]?.message?.content || `智谱AI返回异常：${response.status}`
    
    messages.value.push({ role: 'assistant', content: reply })

  } catch (error) {
    console.error('调用智谱AI出错：', error)
    messages.value.push({
      role: 'assistant',
      content: `❌ 请求失败：${error.message || '请检查密钥与网络。'}`
    })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.chat-container {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  padding: 20px;
  background-color: #1d1d1f;
  font-family: 'AlimamaShuHeiTi', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #ffffff;
}
.chat-container h1 {
  margin: 0 0 16px;
  font-size: 2rem;
  font-weight: 800;
  text-align: center;
  letter-spacing: -0.05em;
  background: linear-gradient(135deg, #0071e3, #7c3aed);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.chat-box {
  flex: 1;
  overflow-y: auto;
  padding: 18px 0 10px;
  background: transparent;
  border: none;
}
.message-wrapper {
  margin-bottom: 16px;
}
.message {
  display: flex;
  align-items: flex-start;
}
.ai-message {
  justify-content: flex-start;
}
.user-message {
  justify-content: flex-end;
}
.bubble {
  max-width: 72%;
  padding: 14px 18px;
  border-radius: 18px;
  word-break: break-word;
  line-height: 1.7;
  font-size: 0.98rem;
}
.ai-bubble {
  background: rgba(255, 255, 255, 0.04);
  color: #e6e6e6;
  border: none;
}
.user-bubble {
  background: linear-gradient(135deg, rgba(0, 113, 227, 0.22), rgba(124, 210, 255, 0.24));
  color: #ffffff;
  border: none;
}
.loading-text {
  text-align: center;
  color: #bfbfbf;
  font-size: 14px;
  padding: 10px 0;
}
.input-area {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: center;
  margin-top: 18px;
}
.chat-input {
  flex: 1;
  padding: 14px 18px;
  border: none;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff;
  font-size: 16px;
  outline: none;
  transition: box-shadow 0.2s;
}
.chat-input::placeholder {
  color: #bfbfbf;
}
.chat-input:focus {
  box-shadow: 0 0 16px rgba(0, 113, 227, 0.16);
}
.send-btn {
  padding: 14px 26px;
  background: #0071e3;
  color: #ffffff;
  border: none;
  border-radius: 14px;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
}
.send-btn:hover:not(:disabled) {
  background: #005bb5;
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgba(0, 91, 181, 0.28);
}
.send-btn:disabled {
  background: #3a3a3d;
  cursor: not-allowed;
}
</style>