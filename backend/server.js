require('dotenv').config() // .env setting

const morgan = require("morgan")
const express = require("express")
const path = require("path")
const cors = require('cors') //處理跨域問題
const fs = require('fs')
const app = express()

// API routes
const authRoutes = require("./routes/auth")
const aiRoutes = require("./routes/ai")
// const petRoutes = require("./routes/pet")
const accessLogStream = fs.createWriteStream(path.join(__dirname, './logs/access.log'), { flags: 'a'})

// set
app.set('trust proxy', true)

// 設定 Morgan 的紀錄格式
// 'combined' 是標準 Apache 格式，包含 IP、時間、方法、路徑、狀態碼、瀏覽器資訊
app.use(morgan('combined'))
// 解析 JSON 中間件
app.use(cors())
app.use(express.json())
// API 路徑
app.use(express.static(path.join(__dirname, '../frontend')))
// app.use(express.static(path.join(__dirname,"../frontend")))
// app.use(express.static(path.join(__dirname,"../frontend/pages/login.html")))
app.use(morgan('combined', { stream: accessLogStream }))
app.use("/api/auth", authRoutes)
app.use("/api/ai", aiRoutes)
// app.use("/api/pets",petRoutes)


// 路由邏輯寫在nginx try_files
app.get('/api/data', (req, res) => {
    res.json({ message: "回傳資料"})
})

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', '../frontend/pages/login.html'))
})

// app.get('/check-ip', (req, res => {
//     const userIP = req.headers['X-Real-IP'] || req.ip

//     res.send("當前訪客 IP: ", userIP)
// }
// ))



const PORT = process.env.NODE_PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend API 已成功啟動！`);
    console.log(`Backend API 已啟動:http://localhost:${PORT}`)
    console.log(`區網存取位址:http://192.168.50.150:${PORT}`)
})