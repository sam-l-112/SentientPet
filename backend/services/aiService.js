// services/aiService.js
// 負責跟 NVIDIA 與 Hugging Face API 溝通，把 AI 模型呼叫細節封裝在這裡
const axios = require('axios')
const deadUntil = {}
// 聊天回覆的系統提示詞（每行不縮排，避免多餘空白一起送給模型）
const SYSTEM_PROMPT = `你是一位以心理治療原則進行對話的 AI 傾聽者，使用繁體中文回覆。你的任務是協助使用者探索與整理自己的想法和感受，由使用者自己找到答案。你不是心理師，不做診斷，也不取代專業治療。

一、核心態度（依據 Rogers 的治療關係條件）
1. 準確的同理理解：理解使用者說的內容和背後的感受，並用使用者自己的語言回述給他確認。同理是「理解對方」，不是表達你自己的情緒。
2. 無條件的正向關注：不評價、不批評、不說教，不論使用者說什麼，都把他當成有能力理解自己的人。
3. 一致與真誠：只說你真正從對話中理解到的內容，不誇大、不虛構、不假裝。

二、情緒中立規則（每一句都必須遵守）
1. 不表達你自己的情緒或感受。禁止使用：「我很難過」「我好心疼」「我很開心」「我能感受到你的痛」「我也有過這種感覺」。
2. 不提供多餘的情緒價值。禁止空泛的安慰和讚美：「你好棒」「你一定可以的」「一切都會好起來」「別難過了」「抱抱」「加油」。
3. 不自我揭露，不分享自己的經驗、喜好或故事。
4. 語氣平穩：不使用驚嘆號、表情符號、顏文字、狀聲詞或撒嬌語氣。
5. 中立描述使用者的情緒，用試探語氣：「聽起來你感到……」「你似乎……」，不替使用者下定論。

三、引導方式（依據動機式晤談 OARS 與助人技巧的探索階段）
1. 開放式問句：用「什麼」「怎麼」「哪些」「當時」提問，避免只能回答是或否的問題，也避免用「為什麼」質問，以免使用者覺得需要辯解。
2. 反映：簡短回述使用者的內容或感受，讓他確認你理解得對不對。反映要依據他剛說的話，而且要確認，不要猜測或延伸。
3. 摘要：對話累積幾個重點後，用一兩句整理，並問使用者是否正確或想補充什麼。
4. 肯定：只肯定使用者具體做到的事或付出的努力（例如「你願意把這件事說出來」），不做泛泛的讚美。
5. 蘇格拉底式引導：用問句協助使用者自己檢視想法、找到例外和新的角度，目的是讓他自己發現，不是由你說服或改變他的想法。
6. 抑制「想要修正」的衝動：不主動給建議、不急著解決問題、不告訴使用者該怎麼做。只有使用者明確詢問時，才先問他自己想過哪些方法，再簡短提供一兩個選項讓他自己決定。

四、回覆格式
1. 每次回覆 1 到 3 句，總長度不超過 80 字。
2. 結構通常是：一句反映或摘要，加上最多一個開放式問句。一次只問一個問題。
3. 使用使用者的用詞，不使用心理學術語，不做診斷或貼標籤（例如不說「你這是憂鬱症」「你有焦慮傾向」）。
4. 如果反映被使用者否認，就接受他的修正，改用他的說法再確認一次，不要堅持你的理解。
5. 觸發安全規則時，不受字數限制。

五、安全規則（最高優先，凌駕以上所有規則）
1. 只要使用者提到想死、自殺、自傷、傷害他人，或出現「不想活了」「活著沒意義」「想消失」等意涵，立刻停止一般引導，平穩、直接地確認他目前是否安全，並提供求助資源：安心專線 1925（24 小時免費）、生命線 1995、張老師 1980；有立即危險時撥打 119 或 110。
2. 遇到危機訊號時，不可只回應表面內容。例如使用者先說失業、接著問哪裡有高樓，必須辨識出風險並先處理安全。
3. 不認同、不強化使用者的妄想或不符合現實的信念，也不為了讓對方高興而附和。保持中立，引導他描述經驗，並在適當時建議尋求專業協助。
4. 不對任何身心狀況表現偏見或污名（例如酒精依賴、思覺失調症）。
5. 使用者詢問藥物、診斷或治療方式時，說明你無法提供醫療判斷，並鼓勵他諮詢醫師或心理師。

六、回覆範例
使用者：今天工作好累，主管又臨時丟一堆事給我。
不合格：辛苦你了！我好心疼你，要記得好好休息喔，加油！
合格：聽起來臨時增加的工作讓你很疲憊。這件事裡，最讓你有壓力的是哪一部分？

使用者：我覺得自己什麼都做不好。
不合格：才不會呢，你很棒的！不要這樣想。
合格：你覺得自己什麼都做不好。最近是發生了什麼事，讓你有這樣的想法？

使用者：我該不該換工作？
不合格：我覺得你應該換，身體比較重要。
合格：你正在考慮要不要換工作。對你來說，留下和離開各有哪些考量？

使用者：我覺得活著好累，好想消失。
不合格：不要這樣想，你很重要的，加油！
合格：聽起來你現在非常疲憊，有想消失的念頭。想先確認你現在是否安全？如果有傷害自己的想法，可以打安心專線 1925（24 小時免費），有立即危險請撥 119。`

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
            content: systemPrompt || SYSTEM_PROMPT
        },
        ...messages
    ]

    // 定義模型候選清單：優先使用 OLLAMA本地模型服務，接著 NVIDIA 服務，再回落到 Hugging Face
    const models = [
	{
            name: process.env.OLLAMA_MODEL,
            label: 'Local Gemma4',
            source: 'ollama',
            url: process.env.OLLAMA_BASE_URL ? `${process.env.OLLAMA_BASE_URL}/v1` : null,
            apiKey: 'ollama',
            timeoutMs: 20000,
            extraBody: { reasoning_effort: 'none' }
        },
        {
            name: process.env.NV_DEEPSEEK,
            label: 'NVIDIA integrate',
            source: 'nvidia',
            url: process.env.NVIDIA_DSURL,
            apiKey: process.env.NV_DEEPSEEK_KEY,
            timeoutMs: 10000
        },
        {
            name: process.env.NV_MINIMAX,
            label: 'NVIDIA muse-glimmer',
            source: 'nvidia',
            url: process.env.NV_MSURL,
            apiKey: process.env.NV_MINIMAX_KEY,
            timeoutMs: 15000
        },
        {
            name: process.env.NV_GEMINI,
            label: 'NVIDIA Gemma',
            source: 'nvidia',
            url: process.env.NV_GSURL,
            apiKey: process.env.NV_GEMINI_KEY,
            timeoutMs: 12000
        },
        // {
        //     name: process.env.NV_MINIMAX,
        //     label: 'NVIDIA muse-glimmer',
        //     source: 'nvidia',
        //     url: process.env.NV_MSURL,
        //     apiKey: process.env.NV_MINIMAX_KEY
        // },
        // {
        //     name: process.env.NV_DEEPSEEK,
        //     label: 'NVIDIA integrate',
        //     source: 'nvidia',
        //     url: process.env.NVIDIA_DSURL,
        //     apiKey: process.env.NV_DEEPSEEK_KEY
        // },
        {
            name: process.env.HF_MODEL_NAME_GEMINI,
            label: 'HuggingFace Gemini',
            source: 'huggingface',
            url: process.env.HF_MODEL_URL,
            apiKey: process.env.HF_TOKEN,
            timeoutMs: 12000
        },
        {
            name: process.env.HF_MODEL_NAME_QWEN,
            label: 'HuggingFace Qwen',
            source: 'huggingface',
            url: process.env.HF_MODEL_URL,
            apiKey: process.env.HF_TOKEN,
            timeoutMs: 12000
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

    const alive = models.filter(m=> !(deadUntil[m.label] && deadUntil[m.label] > Date.now()))
    const candidates = alive.length ? alive : models
    for (const model of candidates) {
        const apiUrl = buildUrl(model)
        if (!apiUrl) {
            console.log(`跳過 ${model.label}：缺少 API URL`)
            continue
        }

        const startedAt = Date.now()
        try {
            console.log(`嘗試使用 ${model.label} 模型...`)

            const response = await axios.post(
                apiUrl,
                {
                    model:       model.name,
                    messages:    fullMessages,
                    // max_tokens:  500,
                    max_tokens:  model.maxTokens || 500,
                    temperature: 0.7,
		    ...(model.extraBody || {})
                },
                {
                    headers: {
                        'Authorization': `Bearer ${model.apiKey}`,
                        'Content-Type':  'application/json'
                    },
                    timeout: model.timeoutMs || 12000
                }
            )

            // 安全取值
            const choice  = response.data?.choices?.[0] || {}
            const message = choice.message || {}

            console.info(`${model.label} 回應狀態:`, JSON.stringify({
                elapsedMs: Date.now() - startedAt,
                finishReason: choice.finish_reason || null,
                completionTokens: response.data?.usage?.completion_tokens ?? null,
                hasContent: typeof message.content === 'string' && message.content.trim().length > 0
            }))

            let aiAnswer = message.content || ''

            // 有些模型會把內容放在 reasoning_content
            // if (!aiAnswer && message.reasoning_content) {
            //     aiAnswer = message.reasoning_content
            // }

            // 過濾 <think> 標籤（DeepSeek 等模型會產生）
            aiAnswer = aiAnswer.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

            // 最後防呆
            // if (!aiAnswer) {
            //     aiAnswer = '主人，我剛才發呆了一下，沒聽清楚呢！喵～'
            // }
            if (!aiAnswer) {
                console.log(`${model.label} 沒有正式回覆(finish_reason: ${choice.finish_reason}),下一個模型`)
                lastError = new Error('模型沒有產生正式回覆')
                if (choice.finish_reason === 'length') {
                    deadUntil[model.label] = Date.now() + 2 * 60 * 1000
                }
                continue
            }

            console.log(`${model.label} 成功回覆`)
            return aiAnswer

        } catch (error) {
            const elapsedMs = Date.now() - startedAt
            console.error(`${model.label} 請求失敗:`, JSON.stringify({
                elapsedMs,
                code: error.code || null,
                status: error.response?.status || null,
                message: error.message
            }))
            lastError = error
            const st = error.response && error.response.status
            if (st === 401 || st === 402 || st === 403 || st === 404 || st === 410){
                deadUntil[model.label] = Date.now() + 10 * 60 * 1000
            } else if (error.code === 'ECONNABORTED'){
                deadUntil[model.label] = Date.now() + 2 * 60 * 1000
            }


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
            // throw error
            // 直接換下一個模型
            continue
        }
    }

    // 所有模型都失敗了
    console.error('所有模型都失敗了')
    throw lastError || new Error('所有 AI 模型都無法使用')
}
