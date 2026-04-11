// controllers/aiController.js
const express = require("express")
const pool      = require('../config/database')
const aiService = require('../services/aiService')

// ── 單次問答（保留原本功能）─────────────────────
exports.askAI = async (req, res) => {
    try {
        const { prompt } = req.body

        if (!prompt) {
            return res.status(400).json({ success: false, message: '請輸入問題' })
        }

        const aiAnswer = await aiService.callAI([
            { role: 'user', content: prompt }
        ])

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

// ── 建立聊天主題 ───────────────────────────────
exports.createSession = async (req, res) => {
    const { title }  = req.body
    const user_id    = req.user?.user_id

    if (!user_id) {
        return res.status(401).json({ success: false, message: '使用者未登入或 Token 錯誤' })
    }

    try {
        const result = await pool.query(
            'INSERT INTO chat_sessions (user_id, title) VALUES (?, ?)',
            [user_id, title || '新對話']
        )

        res.status(201).json({
            success: true,
            message: '建立成功',
            cs_id:   Number(result.insertId)
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ success: false, message: '伺服器錯誤' })
    }
}

// ── 取得所有聊天主題 ───────────────────────────
exports.getSessions = async (req, res) => {
    const user_id = req.user.user_id

    try {
        const sessions = await pool.query(
            `SELECT cs_id, title, created_at
             FROM chat_sessions
             WHERE user_id = ?
             ORDER BY created_at DESC`,
            [user_id]
        )
        res.json({ success: true, sessions })
    } catch (err) {
        console.error(err)
        res.status(500).json({ success: false, message: '伺服器錯誤' })
    }
}

// ── 聊天（含歷史記憶）────────────────────────
exports.chat = async (req, res) => {
    const { cs_id, content } = req.body
    const user_id = req.user.user_id

    if (!cs_id || !content) {
        return res.status(400).json({ success: false, message: '缺少 cs_id 或 content' })
    }

    try {
        // 確認 session 屬於此使用者
        const session = await pool.query(
            'SELECT * FROM chat_sessions WHERE cs_id = ? AND user_id = ?',
            [cs_id, user_id]
        )
        if (session.length === 0) {
            return res.status(403).json({ success: false, message: '無權限存取此對話' })
        }

        // 1. 存入使用者訊息
        await pool.query(
            'INSERT INTO messages (cs_id, role, content) VALUES (?, ?, ?)',
            [cs_id, 'user', content]
        )

        // 2. 取得歷史訊息（最近 20 則，避免 token 超限）
        const history = await pool.query(
            `SELECT role, content FROM messages
             WHERE cs_id = ?
             ORDER BY created_at DESC
             LIMIT 20`,
            [cs_id]
        )

        // 3. 取得使用者長期記憶
        const memories = await pool.query(
            `SELECT content, type FROM memories
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT 10`,
            [user_id]
        )

        // 4. 組合 system prompt（加入記憶）
        let systemPrompt =
            '你是一個友善、樂於助人的虛擬寵物，請以口語化、自然且簡潔的繁體中文回答，不需要顯示思考過程。\n'

        if (memories.length > 0) {
            systemPrompt += '\n以下是你對這位主人的記憶，請自然地運用：\n'
            memories.forEach(m => {
                systemPrompt += `[${m.type}] ${m.content}\n`
            })
        }

        // 5. 呼叫 AI
        const aiReply = await aiService.callAI(
            history.map(m => ({ role: m.role, content: m.content })),
            systemPrompt
        )

        // 6. 存入 AI 回覆
        await pool.query(
            'INSERT INTO messages (cs_id, role, content) VALUES (?, ?, ?)',
            [cs_id, 'assistant', aiReply]
        )

        // 7. 背景自動擷取記憶（不影響回應速度）
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

// ── 取得聊天紀錄 ───────────────────────────────
exports.getHistory = async (req, res) => {
    const { cs_id } = req.params
    const user_id   = req.user.user_id

    try {
        const session = await pool.query(
            'SELECT * FROM chat_sessions WHERE cs_id = ? AND user_id = ?',
            [cs_id, user_id]
        )
        if (session.length === 0) {
            return res.status(403).json({ success: false, message: '無權限存取此對話' })
        }

        const messages = await pool.query(
            `SELECT mes_id, role, content, created_at
             FROM messages
             WHERE cs_id = ?
             ORDER BY created_at ASC`,
            [cs_id]
        )

        res.json({ success: true, cs_id, messages })

    } catch (err) {
        console.error(err)
        res.status(500).json({ success: false, message: '伺服器錯誤' })
    }
}

// ── 自動擷取記憶（內部背景函式）──────────────
async function extractMemory(user_id, userMessage, aiReply) {
    try {
        // 用 AI 判斷是否有值得記憶的資訊
        const result = await aiService.callAI(
            [{
                role: 'user',
                content: `使用者說：${userMessage}\nAI回應：${aiReply}`
            }],
            `你是記憶擷取助手。
從對話中找出值得長期記憶的使用者資訊（例如：名字、喜好、困擾、目標）。
如果有，只回傳 JSON,沒有則只回傳 null。
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
        // 記憶擷取失敗不影響主流程
        console.error('記憶擷取失敗:', err.message)
    }
}