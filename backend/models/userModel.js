const pool = require("../config/database")

exports.findUser = async(username)=>{

const conn = await pool.getConnection()

const rows = await conn.query(
"SELECT * FROM users WHERE username=?",
[username]
)

conn.release()

return rows[0]

}