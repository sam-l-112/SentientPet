async function loadUser() {
    // 假設有一個 API 來取得用戶資料
    // 目前沒有，所以先 alert
    alert("此功能尚未實現，需要後端 API");

    // 示例：如果有 API
    // const res = await fetch("/api/auth/me");
    // const data = await res.json();
    // document.getElementById("userinfo").innerText = JSON.stringify(data);
}

// function logout(){
//     localStorage.removeItem("token")

//     alert("你已成功登出")
//     window.location.href = "login.htmel";
// }

// document.getElementById("logoutBtn").addEventListener("click", logout)
// // 確保按鈕存在後再綁定監聽器
// const logoutBtn = document.getElementById("logoutBtn");
// if (logoutBtn) {
//     logoutBtn.addEventListener("click", logout);
// }
// // login.js
// function loginSuccess(token) {
//     localStorage.setItem("token", token); // 存票券
//     window.location.href = "index.html";  // 跳轉到首頁
// }
// // 在頁面載入時執行
// window.onload = function() {
//     const token = localStorage.getItem("token");
//     if (!token) {
//         // 如果找不到 Token，表示未登入
//         alert("請先登入！");
//         window.location.href = "login.html";
//     }
// };
// // index.js
// function logout() {
//     localStorage.removeItem("token");     // 丟掉票券
//     window.location.href = "login.html";  // 回到登入頁
// }

// ai 使用
// async function callAI() {
//     const userInput = document.getElementById("ai-input").value;
    
//     try {
//         // 透過你的 Nginx -> Node.js -> Hugging Face
//         const res = await api.post("/ai/ask", { prompt: userInput });
//         console.log("AI 回覆：", res.data.data);
//     } catch (error) {
//         alert("AI 呼叫失敗");
//     }
// }
