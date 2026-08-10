// functions/api/chat.js
export async function onRequest(context) {
    // 只处理 POST 请求
    if (context.request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 })
    }

    // 解析请求体
    const { message, enabledAIs, history, needSummary } = await context.request.json()
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
            name: 'GLM-4.7-Flash',
            url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
            key: env.VITE_ZHIPU_KEY,
            model: 'GLM-4.7-Flash',
            color: '#6C5CE7'
        },
        GLM5: {
            name: 'GLM-5',
            url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
            key: env.VITE_ZHIPU_KEY,
            model: 'glm-5',
            color: '#1890FF'
        },
        openrouter: {
            name: 'Nemotron-3-Ultra-550B',
            url: 'https://openrouter.ai/api/v1/chat/completions',
            key: env.VITE_OPENROUTER_KEY,
            model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
            color: '#00B894'
        },
        gemma: {
            name: 'Gemma-4-26B',
            url: 'https://openrouter.ai/api/v1/chat/completions',
            key: env.VITE_OPENROUTER_KEY,
            model: 'google/gemma-4-26b-a4b-it:free',
            color: '#FFC107'
        },
        GLM4f: {
            name: 'GLM-4.7-FlashX',
            url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
            key: env.VITE_ZHIPU_KEY,
            model: 'glm-4.7-flashx',
            color: '#7db300'
        },
        GLM5_1: {
            name: 'GLM-5.1',
            url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
            key: env.VITE_ZHIPU_KEY,
            model: 'glm-5.1',
            color: '#00afaf'
        },
        emoh: {
            name: 'Emohaa(心理咨询模型)',
            url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
            key: env.VITE_ZHIPU_KEY,
            model: 'Emohaa',
            color: '#cc00d3'
        }

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

            // 存储每个AI的完整回答（用于后续总结）
            const aiAnswers = {}

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
                                {
                                    role: 'system',
                                    content: `你是一个专业的AI助手。请始终使用中文回复用户的问题。
当需要展示数学公式时：简单的行内公式用单个美元符号包裹（例如 $E=mc^2$），复杂的独立公式用双美元符号包裹并单独成行。
注意：直接给出答案即可，不要提及格式要求或说明你使用了什么格式。`
                                },
                                ...(history || []),  // 插入历史消息
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
                    let fullAnswer = ''  // 收集完整回答

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
                                        fullAnswer += delta  // 累加到完整回答
                                        sendEvent('delta', { aiKey: key, content: delta })
                                    }
                                } catch (e) {
                                    // 忽略非 JSON
                                }
                            }
                        }
                    }

                    // 保存该AI的完整回答
                    aiAnswers[key] = {
                        name: config.name,
                        answer: fullAnswer
                    }

                    sendEvent('done', { aiKey: key })
                } catch (error) {
                    sendEvent('error', { aiKey: key, error: error.message })
                }
            })

            await Promise.allSettled(tasks)

            // 如果需要总结，使用GLM-5基于所有AI的回答生成综合总结
            if (needSummary && Object.keys(aiAnswers).length > 0) {
                try {
                    const glm5Config = AI_CONFIGS['GLM5']
                    if (glm5Config && glm5Config.key) {
                        sendEvent('summary_start', { aiKey: 'summary' })

                        // 构建包含所有AI回答的文本
                        let allAnswersText = `用户问题：${message}\n\n以下是多个AI模型的回答：\n\n`

                        Object.entries(aiAnswers).forEach(([key, data]) => {
                            allAnswersText += `【${data.name}】的回答：\n${data.answer}\n\n---\n\n`
                        })

                        const summaryResponse = await fetch(glm5Config.url, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${glm5Config.key}`
                            },
                            body: JSON.stringify({
                                model: glm5Config.model,
                                stream: true,
                                messages: [
                                    {
                                        role: 'system',
                                        content: `你是一个专业的AI总结助手。你的任务是基于多个AI模型对同一问题的回答，生成一个简洁、准确、全面的总结。

要求：
1. 提取所有回答中的共同观点和关键信息
2. 整合不同角度和补充信息
3. 使用清晰的条理结构
4. 直接输出总结内容，不要有任何前缀或说明`
                                    },
                                    { role: 'user', content: allAnswersText }
                                ]
                            })
                        })

                        if (summaryResponse.ok) {
                            const reader = summaryResponse.body.getReader()
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
                                                sendEvent('summary_delta', { aiKey: 'summary', content: delta })
                                            }
                                        } catch (e) {
                                            // 忽略非 JSON
                                        }
                                    }
                                }
                            }
                        }

                        sendEvent('summary_done', { aiKey: 'summary' })
                    }
                } catch (error) {
                    sendEvent('error', { aiKey: 'summary', error: `总结失败: ${error.message}` })
                }
            }

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