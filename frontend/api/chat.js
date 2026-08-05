// functions/api/chat.js
export async function onRequest(context) {
    // 只处理 POST 请求
    if (context.request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 })
    }

    // 解析请求体
    const { message, enabledAIs } = await context.request.json()
    if (!message) {
        return new Response(JSON.stringify({ error: 'message required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        })
    }

    // 获取环境变量（在 Cloudflare Dashboard 设置）
    const env = context.env

    // AI 配置（从环境变量读取密钥）
    const AI_CONFIGS = {
        zhipu: {
            name: '智谱GLM',
            url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
            key: env.VITE_ZHIPU_KEY,
            model: 'glm-4-flash'
        },
        ling: {
            name: 'Ling',
            url: 'https://openrouter.ai/api/v1/chat/completions',
            key: env.VITE_OPENROUTER_KEY,
            model: 'inclusionai/ling-3.0-flash:free'
        },
        openrouter: {
            name: 'GPT-OSS-20B',
            url: 'https://openrouter.ai/api/v1/chat/completions',
            key: env.VITE_OPENROUTER_KEY,
            model: 'openai/gpt-oss-20b:free'
        }
        // 可以继续添加
    }

    // 去重
    const aiList = [...new Set(enabledAIs)]

    // 创建 SSE 流
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (event, data) => {
                controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
            }

            // 并行处理所有 AI
            const tasks = aiList.map(async (key) => {
                const config = AI_CONFIGS[key]
                if (!config || !config.key) {
                    sendEvent('error', { aiKey: key, error: '未配置密钥' })
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
                                { role: 'system', content: '请用中文回答。行内公式用 $...$，块级公式用 $$...$$。' },
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
                                    // 忽略非 JSON
                                }
                            }
                        }
                    }

                    sendEvent('done', { aiKey: key })
                } catch (error) {
                    sendEvent('error', { aiKey: key, error: error.message })
                }
            })

            await Promise.allSettled(tasks)
            sendEvent('close', {})
            controller.close()
        }
    })

    // 返回 SSE 响应
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        }
    })
}