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
        const { title = 'New Chat' } = req.body
        const result = await pool.query(
            'INSERT INTO chat_sessions (user_id, title) VALUES (?, ?)',
            [user_id, title]
        )

        res.status(201).json({
            success: true,
            cs_id: Number(result.insertId)
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
            `SELECT user_id, cs_id
             FROM chat_sessions
             WHERE user_id = ?
             ORDER BY updated_at DESC`,
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
    // const chat_session_time_date = req.params.session_time
    const cs_id = req.params.cs_id
    const { content } = req.body
    const user_id = req.user.user_id

    if (!cs_id || !content) {
        return res.status(400).json({ success: false, message: 'Missing conversation error' })
    }

    try {
        // 確認 session 屬於此使用者
        // mariadb 不需要解構
        const session = await pool.query(
            'SELECT * FROM chat_sessions WHERE cs_id = ? AND user_id = ?',
            [cs_id, user_id]
        )
        if (session.length === 0) {
            return res.status(403).json({ success: false, message: '無存取此對話' })
        }

        // 1. 存入使用者訊息
        const userInsertResult =  await pool.query(
            `INSERT INTO messages (cs_id, role, content)
             VALUES (?, 'user', ?)`,
            [cs_id, content]
        )
        const user_mes_id = Number(userInsertResult.insertId);

        // 2. 取得歷史訊息
        // mariadb 不需要解構
        const history = await pool.query(
            `SELECT role, content FROM messages
             WHERE cs_id = ?
             ORDER BY message_at ASC
             LIMIT 20`,
            [cs_id]
        )

        // 3. 組合 system prompt
        let systemPrompt = '你是一個友善、樂於助人的虛擬寵物... Communication at zh-Tw。\n'

        // 4. 組合 messages
        const messages = history.map(m => ({
            role:    m.role,
            content: m.content
        }))

        // 5. 呼叫 AI
        const aiReply = await aiService.callAI(messages, systemPrompt)

        // 6. 存 AI
        const aiInsertResult = await pool.query(
            `INSERT INTO messages (cs_id, role, content)
             VALUES (?, 'assistant', ?)`,
            [cs_id , aiReply]
        );

        const ai_mes_id = Number(aiInsertResult.insertId);

        res.json({ 
            success: true, 
            reply: aiReply,
            mes_id: ai_mes_id,
            user_mes_id: user_mes_id
         })

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
    // const chat_session_time_date = req.params.session_time || req.params.chat_session_time_date
    const cs_id = req.params.cs_id
    const user_id = req.user.user_id

    try {
        // 查看紀錄 mariadb 不需要解構
        const session = await pool.query(
            'SELECT * FROM chat_sessions WHERE cs_id = ? AND user_id = ?',
            [cs_id, user_id]
        )
        if (session.length === 0) {
            return res.status(403).json({ success: false, message: '無權限存取此對話' })
        }

        // 取得聊天資訊 mariadb 不需要解構
        const messages = await pool.query(
            `SELECT role, content, message_at
             FROM messages
             WHERE cs_id = ?
             ORDER BY message_at ASC`,
            [cs_id]
        )

        res.json({ success: true, messages })

    } catch (err) {
        console.error(err)
        res.status(500).json({ success: false, message: '伺服器錯誤' })
    }
}