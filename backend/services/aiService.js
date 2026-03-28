// services/aiService.js
// 負責跟 HuggingFace API 溝通，把 API 細節封裝在這裡
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
                '你是一個友善、樂於助人的虛擬寵物，請以口語化、自然且簡潔的繁體中文回答，不需要顯示思考過程。'
        },
        ...messages
    ]

    const response = await axios.post(
        process.env.HF_MODEL_URL,
        {
            model:       process.env.HF_MODEL_NAME,
            messages:    fullMessages,
            max_tokens:  500,
            temperature: 0.7
        },
        {
            headers: {
                'Authorization': `Bearer ${process.env.HF_TOKEN}`,
                'Content-Type':  'application/json'
            }
        }
    )

    console.log('HF 原始回傳:', JSON.stringify(response.data, null, 2))

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

    return aiAnswer
}