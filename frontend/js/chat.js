/* ═══════════════════════════════════════════════════
   ★ 核心：呼叫聊天 API (對齊 Sam 的後端)
   ═══════════════════════════════════════════════════ */

// ══════════════════════════════════════════════════════════════
// 全域變數
// ══════════════════════════════════════════════════════════════
const API_BASE = "http://210.70.254.110:2237";
const messagesEl = document.getElementById("messages");
const welcomeEl = document.getElementById("welcome");
const inputEl = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

// 目前對話的訊息歷史（用於送給 AI）
let history = [];

// 目前的對話 ID
let currentCsId = null;

// ══════════════════════════════════════════════════════════════
// 頁面載入時自動執行：載入對話歷史
// ══════════════════════════════════════════════════════════════
async function init() {
  const token = localStorage.getItem("token");
  
  // 1. 檢查登入狀態
  if (!token) {
    window.location.href = "pages/login.html";
    return;
  }

  // 2. 檢查是否有現有的對話 ID
  currentCsId = localStorage.getItem("current_cs_id");

  if (currentCsId) {
    // 如果有，載入該對話的歷史訊息
    await loadHistory(currentCsId);
  } else {
    // 如果沒有，建立一個新的對話
    await createSession();
  }
}

// ══════════════════════════════════════════════════════════════
// 建立新對話 Session
// ══════════════════════════════════════════════════════════════
async function createSession() {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API_BASE}/api/ai/session`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${token}` 
      },
      body: JSON.stringify({ title: "新對話" })
    });

    const data = await res.json();
    
    if (data.success && data.cs_id) {
      currentCsId = data.cs_id;
      localStorage.setItem("current_cs_id", currentCsId);
    } else {
      throw new Error("初始化對話失敗");
    }

  } catch (err) {
    console.error("建立對話失敗:", err);
    appendMessage("bot", "⚠️ 無法建立對話，請重新整理頁面");
  }
}

// ══════════════════════════════════════════════════════════════
// 載入對話歷史訊息
// ══════════════════════════════════════════════════════════════
async function loadHistory(csId) {
  const token = localStorage.getItem("token");
  if (welcomeEl) welcomeEl.style.display = "none";
  messagesEl.innerHTML = "<div style='text-align:center; color:gray; padding:20px;'>讀取紀錄中...</div>";

  const url = `${API_BASE}/api/ai/history/${csId}?t=${new Date().getTime()}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    const data = await res.json();
    console.log("📍 歷史紀錄抓取結果:", data);

    // ★ 修改點：檢查 data.messages 而不是 data.history
    if (data.success && Array.isArray(data.messages) && data.messages.length > 0) {
      messagesEl.innerHTML = ""; 
      history = []; 

      data.messages.forEach(msg => {
        const role = msg.role === "user" ? "user" : "bot";
        // 確保這裡抓的是 content
        const content = msg.content || ""; 
        
        appendMessage(role, content, false); 
        
        history.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: content
        });
      });
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } else {
      messagesEl.innerHTML = "";
      if (welcomeEl) welcomeEl.style.display = "block";
    }
  } catch (err) {
    console.error("❌ 載入失敗:", err);
    messagesEl.innerHTML = "";
  }
}

// ══════════════════════════════════════════════════════════════
// 發送訊息給 AI
// ══════════════════════════════════════════════════════════════

// 新增：把清理函式獨立出來，避免報錯
function sanitizeAnswer(text) {
  if (typeof text !== "string") return text;
  let s = text.trim();
  const thinkingProcessRegex = /^(\d+\.\s*\*\*[^*]+\*\*\s*[\s\S]*?)(?:Final Choice\s*[:：]|最終選擇\s*[:：]|您好)/i;
  const matchComplex = s.match(thinkingProcessRegex);
  if (matchComplex) {
    const afterThinking = s.substring(matchComplex[0].length).trim();
    if (afterThinking.length > 0) s = afterThinking;
  }
  const m = s.match(/Final Choice\s*[:：]\s*([\s\S]*)$/i) || s.match(/最終選擇\s*[:：]\s*([\s\S]*)$/i);
  if (m && m[1]) return m[1].trim();
  return s.replace(/<think>[\s\S]*?<\/think>/g, "").trim(); 
}

async function callAPI(messages) {
  const userMessage = messages[messages.length - 1].content;
  const token = localStorage.getItem('token');
  if (!token) throw new Error("請先登入");

  const res = await fetch(`${API_BASE}/api/ai/chat`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json", 
      "Authorization": `Bearer ${token}` 
    },
    body: JSON.stringify({ 
      cs_id: Number(currentCsId), 
      content: userMessage 
    })
  });

  const rawText = await res.text();
  if (!res.ok) throw new Error(`伺服器錯誤: ${res.status}`);

  try {
    const data = JSON.parse(rawText);
    // ★ 這裡呼叫的是剛才移到全域的 sanitizeAnswer
    if (data.success) return sanitizeAnswer(data.reply); 
    throw new Error(data.message || "未知錯誤");
  } catch (e) {
    return sanitizeAnswer(rawText);
  }
}

/* ═══════════════════════════════════════════════════
   ★ UI 邏輯 (配合 callAPI)
   ═══════════════════════════════════════════════════ */

async function handleSend() {
  const text = inputEl.value.trim();
  if (!text || sendBtn.disabled) return;

  inputEl.value = "";
  inputEl.style.height = "auto";
  sendBtn.disabled = true;

  appendMessage("user", text);
  history.push({ role: "user", content: text });
  showTyping();

  try {
    let reply = await callAPI([...history]);
    if (window.toTraditional) reply = window.toTraditional(reply);
    
    removeTyping();
    appendMessage("bot", reply);
    history.push({ role: "assistant", content: reply });
  } catch (err) {
    removeTyping();
    appendMessage("bot", `⚠️ ${err.message}`);
  } finally {
    sendBtn.disabled = false;
  }
}

function appendMessage(role, text, shouldScroll = true) {
  if (welcomeEl) welcomeEl.style.display = "none";

  const row = document.createElement("div");
  row.className = `row ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  row.innerHTML = `<div class="mini-avatar">${role === "user" ? "你" : "AI"}</div>`;
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  
  if (shouldScroll) {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

function showTyping() {
  const row = document.createElement("div");
  row.className = "row bot";
  row.id = "typing-row";
  row.innerHTML = `<div class="mini-avatar">AI</div><div class="bubble typing-bubble"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeTyping() { 
  document.getElementById("typing-row")?.remove(); 
}

// 輸入框自動調整高度
inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 130) + "px";
  sendBtn.disabled = !inputEl.value.trim();
});

// Enter 送出，Shift+Enter 換行
inputEl.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { 
    e.preventDefault(); 
    handleSend(); 
  }
});

// 送出按鈕
sendBtn.addEventListener("click", handleSend);

// ══════════════════════════════════════════════════════════════
// 頁面載入時執行初始化
// ══════════════════════════════════════════════════════════════
init();