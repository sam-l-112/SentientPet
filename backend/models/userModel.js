// models/userModel.js
const pool = require('../config/database')

// 用帳號查詢（登入用）
exports.findByUsername = async (username) => {
    const rows = await pool.query(
        'SELECT * FROM users WHERE username = ?',
        [username]
    )
    return rows[0] || null
}

// 用信箱查詢（註冊檢查用）
exports.findByEmail = async (email) => {
    const rows = await pool.query(
        'SELECT * FROM users WHERE email = ?',
        [email]
    )
    return rows[0] || null
}

// 建立新使用者
exports.createUser = async (username, hashedPassword, email) => {
    const result = await pool.query(
        'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
        [username, hashedPassword, email]
    )
    return Number(result.insertId)
}