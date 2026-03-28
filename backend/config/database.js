const mariadb = require("mariadb")
require('dotenv').config()

const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT) || 3306,
    // waitForConnections: true,
    connectionLimit: 5
})
// 連線測試 test connection 或 Check connection
pool.getConnection()
    .then(conn => {
        console.log(`✅ 資料庫連線成功！已連接到 ${process.env.DB_DATABASE}`)
        conn.release()
    })
    .catch(err => {
        console.error('❌ 資料庫連線失敗:', err.message)
    })

module.exports = pool