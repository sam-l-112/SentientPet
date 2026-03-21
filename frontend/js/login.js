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

document.getElementById("loginForm").addEventListener("submit", function(event) {
    event.preventDefault();
    login();
});