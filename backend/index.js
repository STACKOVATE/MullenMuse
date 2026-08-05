const express = require('express')
const cors = require('cors')
require('dotenv').config()

const app = express()
app.use(cors())
app.use(express.json())

// ---------- AI 配置（从环境变量读取密钥） ----------
const AI_CONFIGS = {
    zhipu: {
        name: '智谱GLM',
        url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        key: process.env.VITE_ZHIPU_KEY,
        model: 'glm-4-flash',
        color: '#6C5CE7'
    },
    ling: {
        name: 'Ling',
        url: 'https://openrouter.ai/api/v1/chat/completions',
        key: process.env.VITE_OPENROUTER_KEY,
        model: 'inclusionai/ling-3.0-flash:free',
        color: '#1890FF'
    },
    openrouter: {
        name: 'GLM5',
        url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        key: process.env.VITE_ZHIPU_KEY,
        model: 'glm-5',
        color: '#00B894'
    },
    Gemma: {
        name: 'Gemma-4-26B',
        url: 'https://openrouter.ai/api/v1/chat/completions',
        key: process.env.VITE_OPENROUTER_KEY,
        model: 'google/gemma-4-26b-a4b-it:free',
        color: '#FFC107' // 黄色
    },
    Poolside: {
        name: 'Laguna S 2.1',
        url: 'https://openrouter.ai/api/v1/chat/completions',
        key: process.env.VITE_OPENROUTER_KEY,
        model: 'poolside/laguna-s-2.1:free',
        color: '#FF69B4' // 粉色
    },
    nvidia: {
        name: 'Nemotron 3 Ultra 550B',
        url: 'https://openrouter.ai/api/v1/chat/completions',
        key: process.env.VITE_OPENROUTER_KEY,
        model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
        color: '#FFA500' // 橙色
    },
}

// ---------- 核心接口：/api/chat ----------
app.post('/api/chat', async (req, res) => {
    const { message, enabledAIs: rawAIs } = req.body
    const aiList = [...new Set(rawAIs)]

    if (!message) {
        return res.status(400).json({ error: 'message 字段不能为空' })
    }
    if (!aiList || !Array.isArray(aiList) || aiList.length === 0) {
        return res.status(400).json({ error: 'enabledAIs 必须是非空数组' })
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders() // 立即发送头部，保持连接

    // 辅助：发送 SSE 事件
    const sendEvent = (event, data) => {
        console.log(`[发送事件] ${event}`, data)
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    // 并行处理每个 AI
    const tasks = aiList.map(async (key) => {
        const config = AI_CONFIGS[key]
        if (!config) {
            sendEvent('error', { aiKey: key, error: `未知 AI: ${key}` })
            return
        }
        if (!config.key) {
            sendEvent('error', { aiKey: key, error: '未配置 API 密钥' })
            return
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
                    stream: true,
                    messages: [
                        {
                            role: 'system',
                            content: `你是一个专业的AI助手。请始终使用中文回复用户的问题。
当需要展示数学公式时：简单的行内公式用单个美元符号包裹（例如 $E=mc^2$），复杂的独立公式用双美元符号包裹并单独成行。
注意：直接给出答案即可，不要提及格式要求或说明你使用了什么格式。`
                        },
                        { role: 'user', content: message }
                    ]
                })
            })

            if (!response.ok) {
                const errText = await response.text()
                sendEvent('error', { aiKey: key, error: `HTTP ${response.status}: ${errText}` })
                return
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let isDoneSent = false

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.substring(6)
                        if (dataStr === '[DONE]') continue
                        try {
                            const json = JSON.parse(dataStr)
                            const delta = json.choices?.[0]?.delta?.content
                            if (delta) {
                                sendEvent('delta', { aiKey: key, content: delta })
                            }
                        } catch (e) {
                            // 忽略非 JSON 数据
                        }
                    }
                }
            }

            if (!isDoneSent) {
                sendEvent('done', { aiKey: key })
                isDoneSent = true
            }

        } catch (error) {
            sendEvent('error', { aiKey: key, error: error.message })
        }
    })

    // 等待所有 AI 完成（无论成功或失败）
    await Promise.allSettled(tasks)

    // 全部完成，发送关闭事件
    sendEvent('close', {})
    res.end()
})

// ---------- 健康检查 ----------
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ---------- 启动服务器 ----------
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log(`✅ MullMuse 后端已启动: http://localhost:${PORT}`)
    console.log(`   POST /api/chat  - 发送对话请求`)
    console.log(`   GET  /health   - 健康检查`)
})