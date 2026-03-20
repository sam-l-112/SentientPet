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
    // 登入成功，重定向到 dashboard
    window.location.href = "dashboard.html";
} else {
    // 顯示錯誤
    document.getElementById("error-msg").innerText = data.message;
}

}

document.getElementById("loginForm").addEventListener("submit", function(event) {
    event.preventDefault();
    login();
});