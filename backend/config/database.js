const mariadb = require("mariadb")

const pool = mariadb.createPool({

    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT) || 3306,
    connectioinLimit: 5
    // 設定.env 檔案之前
// host:"localhost",

// user:"appuser",

// password:"password",

// database:"logindb",

// connectionLimit:5

})

module.exports = pool