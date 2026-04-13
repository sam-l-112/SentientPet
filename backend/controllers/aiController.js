// controllers/aiController.js
const pool      = require('../config/database')
const aiService = require('../services/aiService')

// -- 統一時間 -----------------------------------
function toMariaDBTime(date = new Date()) {
    return date.toISOString().slice(0, 19).replace('T', ' ')
}

// ── 單次問答 ─────────────────────────────────────────
exports.askAI = async (req, res) => {
    try {
        const { prompt } = req.body

        if (!prompt) {
            return res.status(400).json({ success: false, message: '請輸入問題' })
        }

        const aiAnswer = await aiService.callAI(
            [{ role: 'user', content: prompt }]
        )

        res.json({ success: true, answer: aiAnswer })

    } catch (error) {
        console.error('--- askAI 發生錯誤 ---')
        if (error.response) {
            console.error('狀態碼:', error.response.status)
            console.error('錯誤訊息:', error.response.data)
        } else {
            console.error('錯誤原因:', error.message)
        }
        res.status(500).json({
            success: false,
            message: '寵物去睡午覺了喵～',
            debug:   error.message
        })
    }
}

// ── 建立聊天 session ──────────────────────────────────
exports.createSession = async (req, res) => {
    const user_id = req.user?.user_id

    if (!user_id) {
        return res.status(401).json({ success: false, message: '使用者未登入錯誤' })
    }

    try {
        const chat_session_time_date = toMariaDBTime()
        await pool.query(
            'INSERT INTO chat_sessions (user_id, chat_session_time_date) VALUES (?, ?)',
            [user_id, chat_session_time_date]
        )

        res.status(201).json({
            success: true,
            message: '建立成功',
            session_key: {
                user_id,
                chat_session_time_date
            }
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ success: false, message: '伺服器錯誤' })
    }
}

// ── 取得所有聊天 session ──────────────────────────────
exports.getSessions = async (req, res) => {
    const user_id = req.user.user_id

    try {
        // mariadb 不需要解構
        const sessions = await pool.query(
            `SELECT user_id, chat_session_time_date
             FROM chat_sessions
             WHERE user_id = ?
             ORDER BY chat_session_time_date DESC`,
            [user_id]
        )
        res.json({ success: true, sessions })
    } catch (err) {
        console.error(err)
        res.status(500).json({ success: false, message: 'server error' })
    }
}

// ── 聊天（含歷史記憶）────────────────────────────────
exports.chat = async (req, res) => {
    const chat_session_time_date = req.params.session_time || req.body.chat_session_time_date
    const { content } = req.body
    const user_id = req.user.user_id

    if (!chat_session_time_date || !content) {
        return res.status(400).json({ success: false, message: 'Missing conversation time' })
    }

    try {
        // 確認 session 屬於此使用者
        // mariadb 不需要解構
        const session = await pool.query(
            'SELECT * FROM chat_sessions WHERE chat_session_time_date = ? AND user_id = ?',
            [chat_session_time_date, user_id]
        )
        if (session.length === 0) {
            return res.status(403).json({ success: false, message: '無存取此對話' })
        }

        // 1. 存入使用者訊息
        const user_message_time_date = toMariaDBTime();
        await pool.query(
            `INSERT INTO messages (user_id, chat_session_time_date, message_time_date, role, content)
             VALUES (?, ?, ?, ?, ?)`,
            [user_id, chat_session_time_date, user_message_time_date, 'user', content]
        )

        // 2. 取得歷史訊息
        // mariadb 不需要解構
        const history = await pool.query(
            `SELECT role, content FROM messages
             WHERE user_id = ? AND chat_session_time_date = ?
             ORDER BY message_time_date ASC
             LIMIT 20`,
            [user_id, chat_session_time_date]
        )

        // 3. 取得使用者長期記憶
        // mariadb 不需要解構
        const memories = await pool.query(
            `SELECT content, type FROM memories
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT 10`,
            [user_id]
        )

        // 4. 組合 system prompt
        let systemPrompt =
            '你是一個友善、樂於助人的虛擬寵物，請以口語化、自然且簡潔的繁體中文回答，不需要顯示思考過程。\n'

        if (memories.length > 0) {
            systemPrompt += '\n以下是你對這位主人的記憶，請自然地運用：\n'
            memories.forEach(m => {
                systemPrompt += `[${m.type}] ${m.content}\n`
            })
        }

        // 5. 組合 messages
        const messages = history.map(m => ({
            role:    m.role,
            content: m.content
        }))

        // 6. 呼叫 AI
        const aiReply = await aiService.callAI(messages, systemPrompt)

        // 7. 存入 AI 回覆（時間 +1ms 確保 PK 不衝突）
        const ai_message_time_date = toMariaDBTime(new Date().getTime() + 1000)
        await pool.query(
            `INSERT INTO messages (user_id, chat_session_time_date, message_time_date, role, content)
             VALUES (?, ?, ?, ?, ?)`,
            [user_id, chat_session_time_date, ai_message_time_date, 'assistant', aiReply]
        )

        // 8. 背景自動擷取記憶
        extractMemory(user_id, content, aiReply)

        res.json({ success: true, reply: aiReply })

    } catch (err) {
        console.error('--- chat 發生錯誤 ---', err.message)
        res.status(500).json({
            success: false,
            message: '寵物去睡午覺了喵～',
            debug:   err.message
        })
    }
}

// ── 取得聊天紀錄 ──────────────────────────────────────
exports.getHistory = async (req, res) => {
    const chat_session_time_date = req.params.session_time || req.params.chat_session_time_date
    const user_id = req.user.user_id

    try {
        // mariadb 不需要解構
        const session = await pool.query(
            'SELECT * FROM chat_sessions WHERE chat_session_time_date = ? AND user_id = ?',
            [chat_session_time_date, user_id]
        )
        if (session.length === 0) {
            return res.status(403).json({ success: false, message: '無權限存取此對話' })
        }

        // mariadb 不需要解構
        const messages = await pool.query(
            `SELECT user_id, chat_session_time_date, role, content, message_time_date
             FROM messages
             WHERE user_id = ? AND chat_session_time_date = ?
             ORDER BY message_time_date ASC`,
            [user_id, chat_session_time_date]
        )

        res.json({ success: true, chat_session_time_date, messages })

    } catch (err) {
        console.error(err)
        res.status(500).json({ success: false, message: '伺服器錯誤' })
    }
}

// ── 自動擷取記憶（內部背景函式）──────────────────────
async function extractMemory(user_id, userMessage, aiReply) {
    try {
        const result = await aiService.callAI(
            [{
                role: 'user',
                content: `使用者說：${userMessage}\nAI回應：${aiReply}`
            }],
            `你是記憶擷取助手。
從對話中找出值得長期記憶的使用者資訊（例如：名字、喜好、困擾、目標）。
如果有，只回傳 JSON，沒有則只回傳 null。
格式：{"type":"preference|personal|issue|goal","content":"記憶內容"}`
        )

        const clean = result.replace(/```json|```/g, '').trim()
        if (clean === 'null' || clean === '') return

        const memory = JSON.parse(clean)

        if (memory?.type && memory?.content) {
            await pool.query(
                'INSERT INTO memories (user_id, content, type) VALUES (?, ?, ?)',
                [user_id, memory.content, memory.type]
            )
            console.log('記憶已儲存:', memory)
        }

    } catch (err) {
        console.error('記憶擷取失敗:', err.message)
    }
}
