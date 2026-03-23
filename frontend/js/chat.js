/* ═══════════════════════════════════════════════════
   ★ 前端聊天 UI
   ═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   核心：呼叫聊天 API
   ═══════════════════════════════════════════════════ */
async function callAPI(messages) {
  const userMessage = messages[messages.length - 1].content;

  // 定義一個函數來清理 AI 的回覆，移除不必要的「思考過程」或格式標記
  function sanitizeAnswer(text) {
    if (typeof text !== "string") return text; // 如果不是字串，直接返回

    let s = text.trim(); // 移除首尾空白字符

    // 【新增過濾規則】
    // 嘗試過濾掉以數字開頭、後面帶有 **...** 格式的思考過程區塊
    // 這個正則表達式會嘗試匹配從「1. **」開始，到「Final Choice:」、「最終選擇:」
    // 或新的問候語（例如「您好」）之前的內容，將其視為思考過程並移除。
    const thinkingProcessRegex = /^(\d+\.\s*\*\*[^*]+\*\*\s*[\s\S]*?)(?:Final Choice\s*[:：]|最終選擇\s*[:：]|您好)/i;
    const matchComplex = s.match(thinkingProcessRegex);
    if (matchComplex) {
        // 如果找到複雜的思考過程模式，提取其後的部分作為新的回覆
        const afterThinking = s.substring(matchComplex[0].length).trim();
        if (afterThinking.length > 0) {
            s = afterThinking;
        } else {
            // 如果提取後沒有內容，表示整個回覆都是思考過程，
            // 這裡可以選擇返回一個預設值，或讓後面的規則去處理原始文字。
            // 目前保持原樣，讓後續規則有機會處理。
        }
    }

    // 【現有邏輯 1】
    // 常見格式：AI 在回覆最後會有 "Final Choice:"（或中文冒號版本）來標示最終答案
    // 此處嘗試匹配並只擷取冒號之後的內容
    const m =
      s.match(/Final Choice\s*[:：]\s*([\s\S]*)$/i) ||
      s.match(/最終選擇\s*[:：]\s*([\s\S]*)$/i);

    if (m && m[1]) return m[1].trim(); // 如果匹配成功且有擷取到內容，則返回該內容

    // 【現有邏輯 2】
    // 退而求其次：去掉回覆開頭的 "Thinking Process:"（若 AI 仍有回傳此類標記）
    if (/Thinking Process\s*:/i.test(s)) {
      return s.replace(/[\s\S]*Thinking Process\s*:\s*/i, "").trim();
    }

    return s; // 如果以上規則都沒有匹配成功，則返回原始（已trim）的文字
  }

  // 連接後端的聊天 API 的函數
  const url = "http://210.70.254.110:2235/api/ai/ask"; // 後端 AI 聊天 API 的端點 URL

  const res = await fetch(url, {
    method: "POST", // 使用 POST 方法發送請求
    headers: { "Content-Type": "application/json" }, // 設定請求內容為 JSON 格式
    // 將使用者訊息和對話歷史轉換為 JSON 字串作為請求體
    // 包含多個常用欄位以兼容不同後端 API 的需求
    body: JSON.stringify({
      message: userMessage, // 當前使用者輸入的訊息
      query: userMessage,   // 另一種常見的訊息欄位名稱
      prompt: userMessage,  // 作為提示詞的訊息欄位名稱
      history: messages,    // 完整的對話歷史，用於提供上下文
      messages,             // 另一種常見的對話歷史欄位名稱
    }),
  });

  // 注意：讀一次 body，避免 res.json() / res.text() 重複取用
  const contentType = res.headers.get("content-type") || "";
  const rawText = await res.text();

  // 若後端回 500，先把 body 丟出來看看伺服器到底抱怨什麼
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

