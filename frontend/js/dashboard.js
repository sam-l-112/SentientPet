async function loadUser() {
    // 假設有一個 API 來取得用戶資料
    // 目前沒有，所以先 alert
    alert("此功能尚未實現，需要後端 API");

    // 示例：如果有 API
    // const res = await fetch("/api/auth/me");
    // const data = await res.json();
    // document.getElementById("userinfo").innerText = JSON.stringify(data);
}

function logout(){
    localStorage.removeItem("token")

    alert("你已成功登出")
    window.location.href = "login.htmel";
}

document.getElementById("logoutBtn").addEventListener("click", logout)