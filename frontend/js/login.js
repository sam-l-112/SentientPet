async function login(){

const username=document.getElementById("username").value
const password=document.getElementById("password").value

const res = await fetch("http://210.70.254.110:2235/api/auth/login",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({
username,
password
})

})

const data = await res.json()

if(data.message === "login success"){
    // 登入成功，存儲用戶資訊並重定向到聊天首頁
    localStorage.setItem("user", JSON.stringify(data.user));
    window.location.href = "../index.html";
} else {
    // 顯示錯誤
    document.getElementById("error-msg").innerText = data.message;
}

}

// 註冊邏輯
async function register(){
    const username = document.getElementById("registerUsername").value;
    const password = document.getElementById("registerPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (password !== confirmPassword) {
        document.getElementById("register-error-msg").innerText = "密碼與確認密碼不符";
        return;
    }

    // 這裡需要 Sam 的註冊 API 端點
    const url = "http://210.70.254.110:2235/api/auth/register"; // 假設註冊 API 是 /api/auth/register

    const res = await fetch(url, {
        method: "POST",
        headers:{
            "Content-Type":"application/json"
        },
        body:JSON.stringify({
            username,
            password
        })
    });

    const data = await res.json();

    if(data.message === "register success"){
        alert("註冊成功，請登入！");
        document.getElementById("register-error-msg").innerText = "";
        showLoginPanel(); // 註冊成功後切回登入頁面
    } else {
        document.getElementById("register-error-msg").innerText = data.message;
    }
}

// 頁面切換邏輯
function showRegisterPanel() {
    document.querySelector(".login-container").style.display = "none";
    document.querySelector(".register-container").style.display = "block";
    document.getElementById("error-msg").innerText = ""; // 清除登入錯誤訊息
}

function showLoginPanel() {
    document.querySelector(".register-container").style.display = "none";
    document.querySelector(".login-container").style.display = "block";
    document.getElementById("register-error-msg").innerText = ""; // 清除註冊錯誤訊息
}

// 事件監聽
document.getElementById("loginForm").addEventListener("submit", function(event) {
    event.preventDefault();
    login();
});

document.getElementById("registerForm").addEventListener("submit", function(event) {
    event.preventDefault();
    register();
});

document.getElementById("showRegister").addEventListener("click", function(event) {
    event.preventDefault();
    showRegisterPanel();
});

document.getElementById("showLogin").addEventListener("click", function(event) {
    event.preventDefault();
    showLoginPanel();
});
