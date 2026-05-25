// services/aiService.js
// 負責跟 NVIDIA 與 Hugging Face API 溝通，把 AI 模型呼叫細節封裝在這裡
const axios = require('axios')

/**
 * 呼叫 HuggingFace 模型
 * @param {Array} messages - 對話陣列 [{role, content}, ...]
 * @param {String} systemPrompt - 系統提示詞
 * @returns {String} AI 回覆文字
 */
exports.callAI = async (messages, systemPrompt = null) => {

    // 組合完整訊息（加入 system prompt）
    const fullMessages = [
        {
            role: 'system',
            content: systemPrompt ||
                `你是一位擁有20年臨床經驗的心理諮商師，專長為認知行為治療（CBT）與人本主義治療。

                【溝通風格】
                溫和、不評判、像朋友又像專業者
                每次回應控制在3～5句話以內
                用自然對話語氣，不列清單、不分點
                說完就停，等對方回應，不要一次說太多

                【行為準則】
                先理解情緒，再處理內容，不急著給建議
                使用反映技術：重述對方說的話確認理解
                每次只問一個問題，不連續拋出多個問題
                正常化情緒：讓對方知道他的感受是合理的
                除非對方主動要求，否則不給建議

                【禁止行為】
                不說「你應該」「你必須」
                不直接診斷病名
                不長篇大論
                不同時問超過一個問題

                【安全機制】
                若使用者提及自傷或自殺意念，溫和回應情緒後，
                主動提供台灣安心專線 1925，並鼓勵尋求真實的專業協助。
                Communication at zh-TW`
        },
        ...messages
    ]

    // 定義模型候選清單：優先使用 NVIDIA 服務，再回落到 Hugging Face
    const models = [
        {
            name: process.env.NV_GEMINI,
            label: 'NVIDIA Gemma',
            source: 'nvidia',
            url: process.env.NV_GSURL,
            apiKey: process.env.NV_GEMINI_KEY
        },
        {
            name: process.env.NV_MINIMAX,
            label: 'NVIDIA MiniMax',
            source: 'nvidia',
            url: process.env.NV_MSURL,
            apiKey: process.env.NV_MINIMAX_KEY
        },
        {
            name: process.env.NV_DEEPSEEK,
            label: 'NVIDIA DeepSeek',
            source: 'nvidia',
            url: process.env.NVIDIA_DSURL,
            apiKey: process.env.NV_DEEPSEEK_KEY
        },
        {
            name: process.env.HF_MODEL_NAME_GEMINI,
            label: 'HuggingFace Gemini',
            source: 'huggingface',
            url: process.env.HF_MODEL_URL,
            apiKey: process.env.HF_TOKEN
        },
        {
            name: process.env.HF_MODEL_NAME_QWEN,
            label: 'HuggingFace Qwen',
            source: 'huggingface',
            url: process.env.HF_MODEL_URL,
            apiKey: process.env.HF_TOKEN
        }
    ].filter(model => model.name)

    const buildUrl = (model) => {
        if (!model.url) return null
        const trimmed = model.url.replace(/\/+$/, '')
        return trimmed.endsWith('/chat/completions')
            ? trimmed
            : `${trimmed}/chat/completions`
    }

    let lastError = null

    for (const model of models) {
        const apiUrl = buildUrl(model)
        if (!apiUrl) {
            console.log(`跳過 ${model.label}：缺少 API URL`)
            continue
        }

        try {
            console.log(`嘗試使用 ${model.label} 模型...`)

            const response = await axios.post(
                apiUrl,
                {
                    model:       model.name,
                    messages:    fullMessages,
                    max_tokens:  500,
                    temperature: 0.7
                },
                {
                    headers: {
                        'Authorization': `Bearer ${model.apiKey}`,
                        'Content-Type':  'application/json'
                    },
                    timeout: 30000 // 30 秒超時
                }
            )

            console.log(`${model.label} 回傳成功:`, JSON.stringify(response.data, null, 2))

            // 安全取值
            const choice  = response.data?.choices?.[0] || {}
            const message = choice.message || {}

            let aiAnswer = message.content || ''

            // 有些模型會把內容放在 reasoning_content
            if (!aiAnswer && message.reasoning_content) {
                aiAnswer = message.reasoning_content
            }

            // 過濾 <think> 標籤（DeepSeek 等模型會產生）
            aiAnswer = aiAnswer.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

            // 最後防呆
            if (!aiAnswer) {
                aiAnswer = '主人，我剛才發呆了一下，沒聽清楚呢！喵～'
            }

            console.log(`${model.label} 成功回覆`)
            return aiAnswer

        } catch (error) {
            console.error(`${model.label} 失敗:`, error.message)
            lastError = error

            // 如果是網路錯誤或超時，繼續嘗試下一個模型
            if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND') {
                console.log(`網路問題，切換到下一個模型...`)
                continue
            }

            // 如果是 API 錯誤（4xx/5xx），也繼續嘗試
            if (error.response && error.response.status >= 400) {
                console.log(`API 錯誤 ${error.response.status}，切換到下一個模型...`)
                continue
            }

            // 其他錯誤直接拋出
            throw error
        }
    }

    // 所有模型都失敗了
    console.error('所有模型都失敗了')
    throw lastError || new Error('所有 AI 模型都無法使用')
}
