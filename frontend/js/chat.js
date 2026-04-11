// 1. 全域變數
const API_BASE = "http://210.70.254.110:2237";
const messagesEl = document.getElementById("messages");
const welcomeEl = document.getElementById("welcome");
const inputEl = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
let history = [];
let currentCsId = null;

// 2. 初始化
async function init() {
  const token = localStorage.getItem("token");
  if (!token) { window.location.href = "pages/login.html"; return; }
  currentCsId = localStorage.getItem("current_cs_id");
  if (currentCsId) { await loadHistory(currentCsId); } else { await createSession(); }
}

// 3. 核心功能：發送訊息
async function handleSend() {
  const text = inputEl.value.trim();
  if (!text || sendBtn.disabled) return;

  inputEl.value = "";
  inputEl.style.height = "auto";
  sendBtn.disabled = true;

  appendMessage("user", text);
  history.push({ role: "user", content: text });
  showTyping();

  // 呼叫雷達圖更新
  updateEmotionRadar(text);

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

// 5. 清理 AI 回覆標籤
function sanitizeAnswer(text) {
  if (typeof text !== "string") return text;
  let s = text.trim();
  s = s.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const m = s.match(/(?:Final Choice|最終選擇)\s*[:：]\s*([\s\S]*)$/i);
  return m ? m[1].trim() : s;
}

// 6. 其他輔助函式 (API 呼叫與 UI 更新)
async function callAPI(messages) {
  const userMessage = messages[messages.length - 1].content;
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}/api/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ cs_id: Number(currentCsId), content: userMessage })
  });
  const rawText = await res.text();
  try {
    const data = JSON.parse(rawText);
    return data.success ? sanitizeAnswer(data.reply) : sanitizeAnswer(rawText);
  } catch (e) { return sanitizeAnswer(rawText); }
}

async function createSession() {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/api/ai/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ title: "新對話" })
  });
  const data = await res.json();
  if (data.success) { currentCsId = data.cs_id; localStorage.setItem("current_cs_id", currentCsId); }
}

async function loadHistory(csId) {
  const token = localStorage.getItem("token");
  if (welcomeEl) welcomeEl.style.display = "none";
  const res = await fetch(`${API_BASE}/api/ai/history/${csId}`, {
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

function appendMessage(role, text, shouldScroll = true) {
  if (welcomeEl) welcomeEl.style.display = "none";
  const row = document.createElement("div");
  row.className = `row ${role}`;
  row.innerHTML = `<div class="mini-avatar">${role === "user" ? "你" : "AI"}</div><div class="bubble">${text}</div>`;
  messagesEl.appendChild(row);
  if (shouldScroll) messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showTyping() {
  const row = document.createElement("div");
  row.className = "row bot"; row.id = "typing-row";
  row.innerHTML = `<div class="mini-avatar">AI</div><div class="bubble typing-bubble"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function removeTyping() { document.getElementById("typing-row")?.remove(); }

inputEl.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } });
sendBtn.addEventListener("click", handleSend);

// ══════════════════════════════════════════════════════════════
// 頁面載入時執行初始化
// ══════════════════════════════════════════════════════════════
init();

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
