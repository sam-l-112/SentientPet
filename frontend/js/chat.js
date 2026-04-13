// ── 全域變數：API 位址、DOM 元素、對話狀態 ──
const API_BASE = "http://210.70.254.110:2237";
const messagesEl = document.getElementById("messages");
const welcomeEl = document.getElementById("welcome");
const inputEl = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
let history = [];
let currentCsId = null;

// 頁面載入時執行：檢查登入狀態，有舊對話則載入，否則建立新對話
async function init() {
  const token = localStorage.getItem("token");
  if (!token) { window.location.href = "pages/login.html"; return; }
  currentCsId = localStorage.getItem("current_cs_id");
  // 排除 localStorage 存到 "undefined" 字串的情況
  if (currentCsId === "undefined") currentCsId = null;
  if (currentCsId) { await loadHistory(currentCsId); } else { await createSession(); }
}

// 處理使用者送出訊息：更新畫面、送給 AI、取得回覆後更新情緒面板
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
    analyzeEmotion(reply);
  } catch (err) {
    removeTyping();
    appendMessage("bot", `⚠️ ${err.message}`);
  } finally {
    sendBtn.disabled = false;
  }
}

// 清理 AI 回覆內容：過濾 <think> 標籤與思考過程，只保留最終回答
function sanitizeAnswer(text) {
  if (typeof text !== "string") return text;
  let s = text.trim();
  s = s.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const m = s.match(/(?:Final Choice|最終選擇)\s*[:：]\s*([\s\S]*)$/i);
  return m ? m[1].trim() : s;
}

// 呼叫後端 AI 聊天 API，帶入 cs_id 與使用者訊息，回傳清理後的 AI 回覆
async function callAPI(messages) {
  const userMessage = messages[messages.length - 1].content;
  const token = localStorage.getItem('token');
  // session_time 放 URL，body 只帶訊息內容
  const res = await fetch(`${API_BASE}/api/ai/session/${encodeURIComponent(currentCsId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ content: userMessage })
  });
  const rawText = await res.text();
  try {
    const data = JSON.parse(rawText);
    return data.success ? sanitizeAnswer(data.reply) : sanitizeAnswer(rawText);
  } catch (e) { return sanitizeAnswer(rawText); }
}

// 向後端建立新的對話 session，取得 cs_id 並存入 localStorage
async function createSession() {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/api/ai/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ title: "新對話" })
  });
  const data = await res.json();
  console.log("createSession 回傳:", data);
  // 儲存後端回傳的 session 時間作為對話識別，取代原本的 cs_id
  if (data.success) { currentCsId = data.session_key.chat_session_time_date; localStorage.setItem("current_cs_id", currentCsId); }
}

// 從後端載入指定 cs_id 的歷史訊息，並渲染到畫面上
async function loadHistory(csId) {
  const token = localStorage.getItem("token");
  if (welcomeEl) welcomeEl.style.display = "none";
  // 依 session_time 取得對話歷史紀錄
  const res = await fetch(`${API_BASE}/api/ai/session/${encodeURIComponent(csId)}/messages`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.success) {
    messagesEl.innerHTML = "";
    data.messages.forEach(msg => {
      appendMessage(msg.role === "user" ? "user" : "bot", msg.content, false);
      history.push({ role: msg.role, content: msg.content });
    });
  }
}

// 將訊息泡泡新增至聊天畫面，role 為 "user" 或 "bot"
function appendMessage(role, text, shouldScroll = true) {
  if (welcomeEl) welcomeEl.style.display = "none";
  const row = document.createElement("div");
  row.className = `row ${role}`;
  row.innerHTML = `<div class="mini-avatar">${role === "user" ? "你" : "AI"}</div><div class="bubble">${text}</div>`;
  messagesEl.appendChild(row);
  if (shouldScroll) messagesEl.scrollTop = messagesEl.scrollHeight;
}

// 顯示 AI 打字中的動畫泡泡
function showTyping() {
  const row = document.createElement("div");
  row.className = "row bot"; row.id = "typing-row";
  row.innerHTML = `<div class="mini-avatar">AI</div><div class="bubble typing-bubble"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// 移除打字中動畫
function removeTyping() { document.getElementById("typing-row")?.remove(); }

// ── 事件監聽：Enter 送出、按鈕點擊 ──
inputEl.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } });
sendBtn.addEventListener("click", handleSend);

// ══════════════════════════════════════════════════════════════
// 頁面載入時執行初始化
// ══════════════════════════════════════════════════════════════
init();

// 對 AI 回覆文字進行關鍵字情緒分析，計算六大情緒分數並更新雷達圖面板
async function analyzeEmotion(text) {
  const scores = { joy: 0, sadness: 0, anger: 0, fear: 0, disgust: 0, surprise: 0 };

  const keywords = {
    joy:      ["開心", "快樂", "高興", "棒", "讚", "好玩", "哈哈", "😊", "😄", "喜歡"],
    sadness:  ["難過", "傷心", "哭", "悲", "痛", "失落", "沮喪", "😢", "😭"],
    anger:    ["生氣", "憤怒", "煩", "討厭", "氣死", "幹", "怒", "😠", "😡"],
    fear:     ["害怕", "恐懼", "擔心", "緊張", "焦慮", "不安", "怕", "😨", "😰"],
    disgust:  ["噁心", "厭惡", "反感", "噁", "惡心", "🤢", "😖"],
    surprise: ["驚訝", "竟然", "沒想到", "真的嗎", "哇", "居然", "😲", "😮"]
  };

  for (const [emotion, words] of Object.entries(keywords)) {
    const count = words.filter(w => text.includes(w)).length;
    scores[emotion] = Math.min(100, count * 30);
  }

  EmotionChart.update(scores);
}
