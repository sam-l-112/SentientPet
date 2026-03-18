/* ═══════════════════════════════════════════════════
   ★ 前端聊天 UI（已移除登入流程）
   ═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   核心：呼叫聊天 API（目前先用假回覆）
   ═══════════════════════════════════════════════════ */
async function callAPI(messages) {
  const userMessage = messages[messages.length - 1].content;

  // TODO：未來若要接後端聊天 API，可在這裡改成 fetch，例如：
  // const res = await fetch("http://localhost:3000/api/chat", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ message: userMessage }),
  // });
  // const data = await res.json();
  // return data.reply;

  // 目前先回傳簡單的假回覆，讓前端可直接使用
  return `（測試）你說的是：「${userMessage}」\n目前後端還沒有聊天 API , 所以先回傳這段測試文字。`;
}

/* ═══════════════════════════════════════════════════
   UI 邏輯
   ═══════════════════════════════════════════════════ */
const messagesEl   = document.getElementById("messages");
const welcomeEl    = document.getElementById("welcome");
const inputEl      = document.getElementById("userInput");
const sendBtn      = document.getElementById("sendBtn");

// 對話歷史（無持久儲存；頁面重整即清空）
const history = []; // [{ role: "user"|"assistant", content: string }]

// 預設就可以輸入；送出按鈕依內容啟用/停用
inputEl.disabled = false;
sendBtn.disabled = !inputEl.value.trim();

/* -- 自動調整 textarea 高度 -- */
inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 130) + "px";
  sendBtn.disabled = !inputEl.value.trim();
});

/* -- Enter 送出（Shift+Enter 換行）-- */
inputEl.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
});
sendBtn.addEventListener("click", handleSend);

/* -- 新增訊息泡泡 -- */
function appendMessage(role, text) {
  welcomeEl.style.display = "none";

  const row = document.createElement("div");
  row.className = `row ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "mini-avatar";
  avatar.textContent = role === "user" ? "你" : "AI";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  row.appendChild(avatar);
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return row;
}

/* -- 顯示 typing [...] 動畫 -- */
function showTyping() {
  welcomeEl.style.display = "none";

  const row = document.createElement("div");
  row.className = "row bot";
  row.id = "typing-row";

  const avatar = document.createElement("div");
  avatar.className = "mini-avatar";
  avatar.textContent = "AI";

  const bubble = document.createElement("div");
  bubble.className = "bubble typing-bubble";
  bubble.innerHTML = `<div class="dot"></div><div class="dot"></div><div class="dot"></div>`;

  row.appendChild(avatar);
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeTyping() {
  document.getElementById("typing-row")?.remove();
}

/* -- 主要送出邏輯 -- */
async function handleSend() {
  const text = inputEl.value.trim();
  if (!text || sendBtn.disabled) return;

  // 清空輸入
  inputEl.value = "";
  inputEl.style.height = "auto";
  sendBtn.disabled = true;

  // 顯示用戶訊息
  appendMessage("user", text);
  history.push({ role: "user", content: text });

  // 顯示 typing 動畫
  showTyping();

  try {
    let reply = await callAPI([...history]);

    // 若有載入簡體轉繁體工具，先把回覆轉成繁體中文再顯示
    if (window.toTraditional && typeof window.toTraditional === "function") {
      reply = window.toTraditional(reply);
    }

    removeTyping();
    appendMessage("bot", reply);
    history.push({ role: "assistant", content: reply });
  } catch (err) {
    removeTyping();
    appendMessage("bot", `⚠️ 發生錯誤：${err.message}`);
  }
}