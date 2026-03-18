require('dotenv').config() // .env setting

const express = require("express")
const path = require("path")
const cors = require('cors') //處理跨域問題
const app = express()

// API routes
const authRoutes = require("./routes/auth")
// const petRoutes = require("./routes/pet")

// 解析 JSON 中間件
app.use(cors())
app.use(express.json())

// 提供 frontend 網頁 nginx 不會用到
// app.use(express.static(path.join(__dirname,"../frontend")))
// app.use(express.static(path.join(__dirname,"../frontend/pages/login.html")))

// API 路徑
app.use("/api/auth", authRoutes)
// app.use("/api/pets",petRoutes)
// 路由邏輯寫在nginx try_files
// 啟動 server
// app.get('*',(req, res)=>{
//     res.sendFile(path.join(__dirname, '../frontend/pages/login.html'))
// })
// app.listen(80, () => console.log('Server running on port 80'))

// app.use(cors({
//     origin: 'http://192.168.50.150', // 只允許來自你伺服器 IP 的請求
//     methods: ['GET', 'POST'],
//     allowedHeaders: ['Content-Type', 'Authorization']
// }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend API running on prot ${PORT}`))