/* ═══════════════════════════════════════════════════
   ★ 前端聊天 UI（已移除登入流程）
   ═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   核心：呼叫聊天 API（目前先用假回覆）
   ═══════════════════════════════════════════════════ */
async function callAPI(messages) {
  const userMessage = messages[messages.length - 1].content;

  // 這份後端會把「Thinking Process」也一起放進 answer 裡，
  // 所以前端需要把中間思考過程濾掉，只顯示最後的最終答案。
  function sanitizeAnswer(text) {
    if (typeof text !== "string") return text;

    const s = text.trim();

    // 常見格式：最後會有 "Final Choice:"（或中文冒號版本）
    const m =
      s.match(/Final Choice\s*[:：]\s*([\s\S]*)$/i) ||
      s.match(/最終選擇\s*[:：]\s*([\s\S]*)$/i);

    if (m && m[1]) return m[1].trim();

    // 退而求其次：去掉開頭的 "Thinking Process:"（若有）
    if (/Thinking Process\s*:/i.test(s)) {
      return s.replace(/[\s\S]*Thinking Process\s*:\s*/i, "").trim();
    }

    return s;
  }

  // 連接後端的聊天 API
  const url = "http://210.70.254.110:2235/api/ai/ask";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // 先把常見欄位都帶上，若後端只需要其中一個，通常不會影響
    body: JSON.stringify({
      message: userMessage,
      query: userMessage,
      prompt: userMessage,
      history: messages,
      messages,
    }),
  });

  // 注意：讀一次 body，避免 res.json() / res.text() 重複取用
  const contentType = res.headers.get("content-type") || "";
  const rawText = await res.text();

  // 若後端回 500，先把 body 丟出來讓你能看伺服器到底抱怨什麼
  if (!res.ok) {
    let parsed = null;
    if (contentType.includes("application/json")) {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = null;
      }
    }
    const detail =
      parsed != null ? JSON.stringify(parsed) : rawText || "(empty response body)";
    throw new Error(`HTTP ${res.status} - ${detail}`);
  }

  // 盡可能兼容不同後端回傳格式
  if (contentType.includes("application/json")) {
    let data = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      // 不是合法 JSON，就直接回原字串
      return rawText;
    }
    const reply =
      data?.reply ??
      data?.answer ??
      data?.message ??
      data?.text ??
      data?.result ??
      data?.data?.reply ??
      data?.data?.answer;
    if (reply != null) return sanitizeAnswer(String(reply));
    // JSON 但沒有預期欄位時，至少把整包回傳顯示出來方便除錯
    return JSON.stringify(data);
  }

  // 非 JSON：直接回傳文字內容
  return rawText;
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

