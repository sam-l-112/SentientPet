/*
    login.js — 登入 / 註冊頁面的 JavaScript 邏輯
    ================================================
    這個檔案負責：
    1. 登入：把帳號密碼送到後端，成功後存 JWT Token 並跳頁
    2. 註冊：把帳號、信箱、密碼送到後端，成功後切換到登入表單
    3. 表單切換：控制登入表單和註冊表單的顯示/隱藏
    4. 前端驗證：在送出前先在瀏覽器端檢查基本格式，減少不必要的 API 請求
 
    載入順序說明：
    這個檔案在 login.html 的 </body> 前面才引入，
    所以執行到這裡時，HTML 裡的所有 DOM 元素都已經存在，
    可以安全地用 getElementById 取得元素。
*/
 
// ── 後端 API 的基礎網址 ──────────────────────────────────────────
// 所有 API 請求都會以這個網址作為開頭，
// 之後如果伺服器位址改變，只需要改這一行就好，不用逐一修改每個 fetch()
const API_BASE = "http://210.70.254.110:2237"
 
 
// ════════════════════════════════════════════════════════════════
// 登入函式
// ════════════════════════════════════════════════════════════════
/*
    流程說明：
    1. 從表單取得帳號和密碼
    2. 基本格式驗證（不能空白）
    3. 用 fetch() 發送 POST 請求到 /api/auth/login
    4. 根據後端回傳的 data.success 判斷登入成功或失敗
    5. 成功：把 token 和 user 存到 localStorage，然後跳頁到 index.html
    6. 失敗：把後端的錯誤訊息顯示在表單下方
*/
async function login() {
    // 取得使用者輸入的帳號和密碼
    // .trim() 是去掉頭尾的空白字元，避免使用者不小心多打空白
    const username = document.getElementById("username").value.trim()
    const password = document.getElementById("password").value
 
    // 取得錯誤訊息的顯示區，先清空上一次的錯誤
    const errorMsg = document.getElementById("error-msg")
    errorMsg.innerText = ""
 
    // ── 前端驗證：欄位不能為空 ──
    // 在送出 API 請求之前先在瀏覽器端做基本檢查，
    // 讓使用者更快知道問題，也不用浪費一次網路請求
    if (!username || !password) {
        errorMsg.innerText = "請填寫帳號與密碼"
        return  // 直接結束函式，不繼續送 API
    }
 
    try {
        // ── 發送登入 API 請求 ──
        // fetch() 是瀏覽器內建的網路請求工具，不需要額外安裝套件
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: "POST",                                      // 登入用 POST 方法
            headers: { "Content-Type": "application/json" },    // 告訴後端我們送的是 JSON 格式
            body: JSON.stringify({ username, password })         // 把帳號密碼轉成 JSON 字串送出
        })
 
        // 把後端回傳的 JSON 字串解析成 JS 物件
        // 後端回傳格式範例（成功）：{ success: true, message: "登入成功", token: "xxx", user: {...} }
        // 後端回傳格式範例（失敗）：{ success: false, message: "帳號或密碼錯誤" }
        const data = await res.json()
 
        if (data.success) {
            // ── 登入成功 ──
 
            // ✅ 存 JWT Token 到 localStorage
            // Token 是後端發給我們的「通行證」，之後打需要登入的 API
            // （例如 /api/ai/chat）時，都要在 header 帶上這個 token
            // 格式：Authorization: Bearer <token>
            localStorage.setItem("token", data.token)
 
            // 存使用者基本資訊（user_id、username、email）到 localStorage
            // JSON.stringify() 是把 JS 物件轉成字串，因為 localStorage 只能存字串
            // 之後要用的時候再用 JSON.parse(localStorage.getItem("user")) 轉回物件
            localStorage.setItem("user", JSON.stringify(data.user))
 
            // 跳轉到主頁面
            // "../" 是因為 login.html 在 pages/ 資料夾裡，
            // 所以要往上一層才能找到 index.html
            window.location.href = "../index.html"
 
        } else {
            // ── 登入失敗 ──
            // 把後端回傳的錯誤原因顯示給使用者
            // 後端為了安全不會說是「帳號錯」還是「密碼錯」，只說「帳號或密碼錯誤」
            // || "登入失敗" 是保險用的，萬一後端沒有回傳 message 欄位時的備用文字
            errorMsg.innerText = data.message || "登入失敗"
        }
 
    } catch (err) {
        // ── 網路錯誤或伺服器掛掉 ──
        // 如果 fetch() 本身失敗（例如後端沒開、網路斷線），
        // 就會跳到這個 catch 區塊
        errorMsg.innerText = "無法連線到伺服器，請稍後再試"
        console.error("login 錯誤:", err)  // 把詳細錯誤印到瀏覽器的開發者工具 Console
    }
}
 
 
// ════════════════════════════════════════════════════════════════
// 註冊函式
// ════════════════════════════════════════════════════════════════
/*
    流程說明：
    1. 從表單取得帳號、信箱、密碼、確認密碼
    2. 前端驗證：欄位不能空、密碼要一致、密碼至少 8 字元
    3. 用 fetch() 發送 POST 請求到 /api/auth/register
    4. 成功：跳出提示，切換回登入表單讓使用者登入
    5. 失敗：顯示後端的錯誤訊息（例如「此帳號已被使用」）
*/
async function register() {
    // 取得所有輸入欄位的值
    const username        = document.getElementById("registerUsername").value.trim()
    const email           = document.getElementById("registerEmail").value.trim()
    const password        = document.getElementById("registerPassword").value
    const confirmPassword = document.getElementById("confirmPassword").value  // 只用來前端比對，不送後端
 
    // 取得錯誤訊息顯示區，先清空上一次的錯誤
    const errorMsg = document.getElementById("register-error-msg")
    errorMsg.innerText = ""
 
    // ── 前端驗證一：所有欄位都不能空白 ──
    if (!username || !email || !password || !confirmPassword) {
        errorMsg.innerText = "請填寫所有欄位"
        return
    }
 
    // ── 前端驗證二：密碼與確認密碼必須一致 ──
    // 這個檢查只在瀏覽器端進行，確認密碼欄位的值不會送到後端
    if (password !== confirmPassword) {
        errorMsg.innerText = "密碼與確認密碼不符"
        return
    }
 
    // ── 前端驗證三：密碼長度至少 8 個字元 ──
    // 後端也有做這個檢查，但在前端先擋可以讓使用者更快知道問題
    if (password.length < 8) {
        errorMsg.innerText = "密碼至少需要 8 個字元"
        return
    }
 
    try {
        // ── 發送註冊 API 請求 ──
        const res = await fetch(`${API_BASE}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username,   // 使用者帳號
                email,      // ✅ 電子郵件（修正前沒帶這個，導致後端因 NOT NULL 限制而失敗）
                password    // 密碼（後端會用 bcrypt 加密後存入資料庫，絕對不明文儲存）
                // 注意：confirmPassword 不需要送到後端，只是前端驗證用
            })
        })
 
        // 解析後端回傳的 JSON
        // 後端回傳格式範例（成功）：{ success: true, message: "註冊成功", user_id: 1 }
        // 後端回傳格式範例（失敗）：{ success: false, message: "此帳號已被使用" }
        const data = await res.json()
 
        if (data.success) {
            // ── 註冊成功 ──
            alert("註冊成功，請登入！")  // 跳出提示讓使用者知道完成了
            errorMsg.innerText = ""      // 清除任何殘留的錯誤訊息
            showLoginPanel()             // 切換回登入表單，讓使用者直接登入
 
        } else {
            // ── 註冊失敗 ──
            // 常見原因：帳號已被使用、信箱已被使用
            errorMsg.innerText = data.message || "註冊失敗"
        }
 
    } catch (err) {
        // ── 網路錯誤或伺服器掛掉 ──
        errorMsg.innerText = "無法連線到伺服器，請稍後再試"
        console.error("register 錯誤:", err)
    }
}
 
 
// ════════════════════════════════════════════════════════════════
// 面板切換函式
// ════════════════════════════════════════════════════════════════
/*
    這兩個函式負責切換「登入表單」和「註冊表單」的顯示狀態。
    用 style.display 來控制，不需要 CSS class 切換：
    - "none"  → 隱藏該元素（完全不佔空間）
    - "block" → 顯示該元素（區塊排版）
    切換時也順便清空另一個表單的錯誤訊息，
    避免殘留上一次的紅色錯誤文字讓使用者困惑。
*/
 
// 顯示「註冊」面板，同時隱藏「登入」面板
function showRegisterPanel() {
    document.querySelector(".login-container").style.display = "none"     // 隱藏登入卡片
    document.querySelector(".register-container").style.display = "block" // 顯示註冊卡片
    document.getElementById("error-msg").innerText = ""                   // 清除登入的錯誤訊息
}
 
// 顯示「登入」面板，同時隱藏「註冊」面板
function showLoginPanel() {
    document.querySelector(".register-container").style.display = "none"  // 隱藏註冊卡片
    document.querySelector(".login-container").style.display = "block"    // 顯示登入卡片
    document.getElementById("register-error-msg").innerText = ""          // 清除註冊的錯誤訊息
}
 
 
// ════════════════════════════════════════════════════════════════
// 事件監聽器綁定
// ════════════════════════════════════════════════════════════════
/*
    addEventListener 的用途：
    讓 HTML 元素「監聽」特定的使用者動作（事件），
    一旦動作發生就執行對應的函式。
 
    為什麼用 submit 事件而不是 button 的 click 事件？
    - 使用者按 Enter 鍵時，submit 也會觸發，體驗更好
    - click 事件只有點按鈕才會觸發
 
    e.preventDefault() 的作用：
    表單的預設行為是「提交後重新整理頁面」，
    呼叫 preventDefault() 可以阻止這個預設行為，
    讓我們改用自己寫的 fetch() 來送資料，不會造成頁面跳轉或重整
*/
 
// 監聽登入表單的送出事件
document.getElementById("loginForm").addEventListener("submit", function (e) {
    e.preventDefault()  // 阻止表單預設的頁面重新整理行為
    login()             // 改由我們自己的 login() 函式處理
})
 
// 監聽註冊表單的送出事件
document.getElementById("registerForm").addEventListener("submit", function (e) {
    e.preventDefault()  // 阻止表單預設的頁面重新整理行為
    register()          // 改由我們自己的 register() 函式處理
})
 
// 監聽「還沒有帳號？註冊」連結的點擊事件
document.getElementById("showRegister").addEventListener("click", function (e) {
    e.preventDefault()   // 阻止 <a href="#"> 的預設行為（跳到頁面頂端）
    showRegisterPanel()  // 切換到註冊面板
})
 
// 監聽「已經有帳號？登入」連結的點擊事件
document.getElementById("showLogin").addEventListener("click", function (e) {
    e.preventDefault()  // 阻止 <a href="#"> 的預設行為
    showLoginPanel()    // 切換回登入面板
})