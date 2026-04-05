require('dotenv').config() // .env setting

const morgan = require("morgan")
const express = require("express")
const path = require("path")
const cors = require('cors') //處理跨域問題
const fs = require('fs')

const app = express()

// -- Log 
const logDir = path.join(__dirname, './logs')
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
}
const accessLogStream = fs.createWriteStream(
    path.join(logDir, 'access.log'), { flags: 'a' }
)

// -- set 基本設定
app.set('trust proxy', true)

// -- Middleware
app.use(morgan('combined')) // console 輸出
app.use(morgan('combined', { stream: accessLogStream })) 
app.use(cors({
    origin: [
        process.env.FRONTEND_URL, 
        process.env.FRONTEND_URL_LH,
        process.env.FRONTEND_URL_NW,
        process.env.FRONTEND_URL_I,
    ].filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json())
// app.use(express.static(path.join(__dirname, '../frontend')))

// --- API 路由 
const authRoutes = require('./routes/auth')
const aiRoutes   = require('./routes/ai')

app.use('/api/auth', authRoutes)
app.use('/api/ai', aiRoutes)

// 路由邏輯寫在nginx try_files
app.get('/api/data', (req, res) => {
    res.json({ message: "回傳資料"})
})

const PORT = process.env.NODE_PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend API 已成功啟動！`);
    console.log(`Backend API 已啟動:http://localhost:${PORT}`)
    console.log(`區網存取位址:http://192.168.50.150:${PORT}`)
})