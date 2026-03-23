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

    const data = await res.json();

    if(data.message === "login success"){
        // 登入成功：
        // 1. 將後端回傳的使用者資訊（例如 username）存儲到瀏覽器的 localStorage 中
        //    localStorage 是一個持久化的儲存空間，即使關閉瀏覽器也會保留
        localStorage.setItem("user", JSON.stringify(data.user));
        // 2. 將頁面重定向到聊天主頁面 (index.html)
        window.location.href = "../index.html";
    } else {
        // 登入失敗：在登入表單下方顯示錯誤訊息
        document.getElementById("error-msg").innerText = data.message;
    }
}

// 註冊邏輯函數
async function register(){
    // 取得註冊表單中的使用者名稱、密碼和確認密碼
    const username = document.getElementById("registerUsername").value;
    const password = document.getElementById("registerPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    // 檢查密碼與確認密碼是否一致
    if (password !== confirmPassword) {
        document.getElementById("register-error-msg").innerText = "密碼與確認密碼不符";
        return;
    }

    // 定義後端註冊 API 的端點 URL
    // IMPORTANT: 這裡假設 Sam 會實作 /api/auth/register 這個 API
    const url = "http://210.70.254.110:2235/api/auth/register"; 

    // 發送 POST 請求到後端註冊 API
    const res = await fetch(url, {
        method: "POST",
        headers:{
            "Content-Type":"application/json" // 設定請求內容為 JSON 格式
        },
        body:JSON.stringify({
            username,
            password
        }) // 將使用者名稱和密碼轉換為 JSON 字串作為請求體
    });

    // 解析後端回傳的 JSON 資料
    const data = await res.json();

    if(data.message === "register success"){
        // 註冊成功：
        // 1. 彈出提示訊息告知使用者註冊成功
        alert("註冊成功，請登入！");
        // 2. 清除註冊表單的錯誤訊息
        document.getElementById("register-error-msg").innerText = "";
        // 3. 切換回登入面板，讓使用者進行登入
        showLoginPanel(); 
    } else {
        // 註冊失敗：在註冊表單下方顯示錯誤訊息
        document.getElementById("register-error-msg").innerText = data.message;
    }
}

// 顯示註冊面板的邏輯函數
function showRegisterPanel() {
    // 隱藏登入容器
    document.querySelector(".login-container").style.display = "none";
    // 顯示註冊容器
    document.querySelector(".register-container").style.display = "block";
    // 清除登入表單可能存在的錯誤訊息
    document.getElementById("error-msg").innerText = ""; 
}

// 顯示登入面板的邏輯函數
function showLoginPanel() {
    // 隱藏註冊容器
    document.querySelector(".register-container").style.display = "none";
    // 顯示登入容器
    document.querySelector(".login-container").style.display = "block";
    // 清除註冊表單可能存在的錯誤訊息
    document.getElementById("register-error-msg").innerText = ""; 
}

// 事件監聽器設定
// 監聽登入表單的提交事件，阻止預設提交行為並呼叫 login 函數
document.getElementById("loginForm").addEventListener("submit", function(event) {
    event.preventDefault(); // 阻止表單的預設提交行為（頁面重整）
    login();
});

// 監聽註冊表單的提交事件，阻止預設提交行為並呼叫 register 函數
document.getElementById("registerForm").addEventListener("submit", function(event) {
    event.preventDefault(); 
    register();
});

// 監聽「註冊」連結的點擊事件，阻止預設行為並呼叫 showRegisterPanel 函數
document.getElementById("showRegister").addEventListener("click", function(event) {
    event.preventDefault(); 
    showRegisterPanel();
});

// 監聽「登入」連結的點擊事件，阻止預設行為並呼叫 showLoginPanel 函數
document.getElementById("showLogin").addEventListener("click", function(event) {
    event.preventDefault(); 
    showLoginPanel();
});
