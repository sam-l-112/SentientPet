require('dotenv').config() // .env setting

const express = require("express")
const path = require("path")
const cors = require('cors') //處理跨域問題
const app = express()

// API routes
const authRoutes = require("./routes/auth")
const aiRoutes = require("./routes/ai")
// const petRoutes = require("./routes/pet")

// 解析 JSON 中間件
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, '../frontend')))
// 提供 frontend 網頁 nginx 不會用到
// app.use(express.static(path.join(__dirname,"../frontend")))
// app.use(express.static(path.join(__dirname,"../frontend/pages/login.html")))

// API 路徑
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



const PORT = process.env.NODE_PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend API 已成功啟動！`);
    console.log(`Backend API 已啟動:http://localhost:${PORT}`)
    console.log(`區網存取位址:http://192.168.50.150:${PORT}`)
})