const pool = require('../config/database');

exports.saveRecord = async (userId, text, sentiment, score) => {
    const sql = `INSERT INTO sentiment_results (user_id, content, sentiment, score) VALUES (?, ?, ?, ?)`;
    return await pool.execute(sql, [userId, text, sentiment, score]);
};