const userModel = require("../models/userModel")
const fs = require("fs")
const path = require("path")

const logFilePath = path.join(__dirname, "../logs/access.log")

exports.login = async (req,res)=>{
const {username,password}=req.body

    try{
        const user = await userModel.findUser(username)

        if(!user){
            console.warn(`[AUTH FAILED]帳號不存在:  ${username} | IP: ${req.ip}`)
            writeLog(`[AUTH FAILED]帳號不存在: ${username} | IP: ${req.ip} | 時間: ${new Date().toLocaleString()}\n`)
            return res.json({message:"user not found"})
        }
        if(user.password!==password){
            console.warn(`[AUTH FAILED]密碼錯誤: ${username} | IP: ${req.ip}`)
            writeLog(`[AUTH FAILED]密碼錯誤: ${username} | IP: ${req.ip} | 時間: ${new Date().toLocaleString()}\n`)
            return res.json({message:"wrong password"})
        }
        
        const successLog = `[AUTH SUCCESS]使用者: ${username} | IP: ${req.ip} | 時間: ${new Date().toLocaleString()}`
        console.log(successLog)
        writeLog(successLog + '\n')
        res.json({
            message:"login success",
            user: { username: user.username }
        })

    }catch(err){
        console.error("Login error:", err.message);
        res.status(500).json({message: "Database connection error"})
    }
}

function writeLog(message){
    fs.appendFile(logFilePath, message, (err) => {
        if(err) console.error("無法寫入 Log 檔案", err)
    })
}