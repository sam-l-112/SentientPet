const userModel = require("../models/userModel")

exports.login = async (req,res)=>{

const {username,password}=req.body

try{

const user = await userModel.findUser(username)

if(!user){
return res.json({message:"user not found"})
}

if(user.password!==password){
return res.json({message:"wrong password"})
}

res.json({message:"login success"})

}catch(err){
    console.error("Login error:", err.message);
    res.status(500).json({message: "Database connection error"})
}

}