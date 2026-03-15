const express = require("express")
const path = require("path")

const app = express()

// API routes
const authRoutes = require("./routes/auth")
// const petRoutes = require("./routes/pet")

// 解析 JSON
app.use(express.json())

// 提供 frontend 網頁
app.use(express.static(path.join(__dirname,"../frontend")))
app.use(express.static(path.join(__dirname,"../frontend/pages/login.html")))

// API 路徑
app.use("/api/auth", authRoutes)
// app.use("/api/pets",petRoutes)

// 啟動 server
app.listen(5001,()=>{
    console.log("server running http://localhost:5001")
})