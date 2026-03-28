const fs = require("fs")
const path = require("path")
const userModel = require('../models/userModel')
const logFilePath = path.join(__dirname, "../logs/access.log")

// ── Log 寫入函式 ───────────────────────────────
function writeLog(message) {
    fs.appendFile(logFilePath, message, (err) => {
        if (err) console.error('無法寫入 Log 檔案', err)
    })
}

// ── 註冊 ──────────────────────────────────────
exports.register = async (req, res) => {
    const { username, password, email } = req.body

 if (password.length < 8) {
        return res.status(400).json({
            success: false,
            message: '密碼至少需要 8 個字元'
        })
    }

    try {
        // 2. 確認帳號是否已存在
        const existingUsername = await userModel.findByUsername(username)
        if (existingUsername) {
            return res.status(409).json({
                success: false,
                message: '此帳號已被使用'
            })
        }

        // 3. 確認信箱是否已存在
        const existingEmail = await userModel.findByEmail(email)
        if (existingEmail) {
            return res.status(409).json({
                success: false,
                message: '此信箱已被使用'
            })
        }

        // 4. 雜湊加密密碼
        const hashedPassword = await bcrypt.hash(password, 10)

        // 5. 存入資料庫
        const user_id = await userModel.createUser(username, hashedPassword, email)

        // 6. 寫入 Log
        const log = `[REGISTER SUCCESS] 使用者: ${username} | IP: ${req.ip} | 時間: ${new Date().toLocaleString()}\n`
        console.log(log)
        writeLog(log)

        res.status(201).json({
            success: true,
            message: '註冊成功',
            user_id
        })

    } catch (err) {
        console.error('register 錯誤:', err.message)
        res.status(500).json({
            success: false,
            message: '伺服器錯誤'
        })
    }
}

// ── 登入 ──────────────────────────────────────
exports.login = async (req, res) => {
    const { username, password } = req.body

    // 1. 基本驗證
    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: '請填寫帳號與密碼'
        })
    }

    try{
        const user = await userModel.findByUsername(username)

        if (!user) {
            // 帳號不存在 → 寫 Log 但回傳模糊訊息（避免帳號被猜測）
            const log = `[AUTH FAILED] 帳號不存在: ${username} | IP: ${req.ip} | 時間: ${new Date().toLocaleString()}\n`
            console.warn(log)
            writeLog(log)
            return res.status(401).json({
                success: false,
                message: '帳號或密碼錯誤'  // 故意不說哪個錯
            })
        }

        // 3. bcrypt 比對密碼（不是明文比對！）
        const isMatch = await bcrypt.compare(password, user.password)
        //                                      ↑            ↑
        //                               使用者輸入    資料庫雜湊

        if (!isMatch) {
            const log = `[AUTH FAILED] 密碼錯誤: ${username} | IP: ${req.ip} | 時間: ${new Date().toLocaleString()}\n`
            console.warn(log)
            writeLog(log)
            return res.status(401).json({
                success: false,
                message: '帳號或密碼錯誤'
            })
        }

        // 4. 產生 JWT Token
        const token = jwt.sign(
            {
                user_id:  user.user_id,
                username: user.username
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        )

        // 5. 寫入成功 Log
        const log = `[AUTH SUCCESS] 使用者: ${username} | IP: ${req.ip} | 時間: ${new Date().toLocaleString()}\n`
        console.log(log)
        writeLog(log)

        // 6. 回傳 Token（絕對不回傳密碼！）
        res.json({
            success: true,
            message: '登入成功',
            token,
            user: {
                user_id:  user.user_id,
                username: user.username,
                email:    user.email
            }
        })

        // if(!user){
        //     console.warn(`[AUTH FAILED]帳號不存在:  ${username} | IP: ${req.ip}`)
        //     writeLog(`[AUTH FAILED]帳號不存在: ${username} | IP: ${req.ip} | 時間: ${new Date().toLocaleString()}\n`)
        //     return res.json({message:"user not found"})
        // }
        // if(user.password!==password){
        //     console.warn(`[AUTH FAILED]密碼錯誤: ${username} | IP: ${req.ip}`)
        //     writeLog(`[AUTH FAILED]密碼錯誤: ${username} | IP: ${req.ip} | 時間: ${new Date().toLocaleString()}\n`)
        //     return res.json({message:"wrong password"})
        // }
        
        // const successLog = `[AUTH SUCCESS]使用者: ${username} | IP: ${req.ip} | 時間: ${new Date().toLocaleString()}`
        // console.log(successLog)
        // writeLog(successLog + '\n')
        // res.json({
        //     message:"login success",
        //     user: { username: user.username }
        // })

    }catch (err) {
        console.error('login 錯誤:', err.message)
        res.status(500).json({
            success: false,
            message: '伺服器錯誤'
        })
    }
}

