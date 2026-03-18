// import axios from 'axios';

const api = axios.create({
    // baseURL: "http://192.168.50.150:3000",
    timeout: 5000,
    // headers: {'Content-Type': 'application/json'}
})

async function login(){

const username=document.getElementById("username").value
const password=document.getElementById("password").value
const errorMsgElement = document.getElementById("error-msg")
// const API_BASE_URL = "http://192.168.50.150:3000"

    try{ 
        const res = await api.post("/api/auth/login",{ username,password })

        const data = res.data
        if (data.message == "login success"){
            // 【重點】進階做法：通常登入成功後，後端會給一個 token
            // 我們可以存在 localStorage
            if (data.token){
                localStorage.setItem("userToken", data.token)
            }
            window.location.href = "dashboard.html"
        } else {
            errorMsgElement.innerText = data.message
        }
    } catch (error){ 
        // Axios 會自動捕捉 4xx 或 5xx 的錯誤
        if (error.response) {
            errorMsgElement.innerText = error.response.data.message || "登入失敗"
        } else {
            errorMsgElement.innerText = "連線伺服器失敗，請稍後再試"
        }
    }
}

document.getElementById("loginForm").addEventListener("submit", function(event) {
    event.preventDefault();
    login();
})