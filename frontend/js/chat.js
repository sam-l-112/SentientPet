/* ═══════════════════════════════════════════════════
   ★ 核心：呼叫聊天 API (對齊 Sam 的後端)
   ═══════════════════════════════════════════════════ */
async function callAPI(messages) {
  const userMessage = messages[messages.length - 1].content;
  const token = localStorage.getItem('token');
  const baseUrl = "http://210.70.254.110:2237/api/ai";

  // 1. 檢查 Token (防止 401)
  if (!token) throw new Error("請先登入");

  // 2. 檢查或建立對話 ID (防止 500)
  let cs_id = localStorage.getItem('current_cs_id');
  if (!cs_id) {
    const sRes = await fetch(`${baseUrl}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ title: "新對話" })
    });
    const sData = await sRes.json();
    if (sData.success) {
      cs_id = sData.cs_id;
      localStorage.setItem('current_cs_id', cs_id);
    } else {
      throw new Error("初始化對話失敗");
    }
  }

  // 3. 清理 AI 回覆的內部函式
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
    return s.replace(/<think>[\s\S]*?<\/think>/g, "").trim(); // 加強過濾標籤
  }

  // 4. 正式發送請求
  const res = await fetch(`${baseUrl}/chat`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json", 
      "Authorization": `Bearer ${token}` 
    },
    body: JSON.stringify({ cs_id: Number(cs_id), content: userMessage }) // 確保 cs_id 是數字
  });

  const rawText = await res.text(); // 先拿原始文字，避免 JSON 解析失敗

  if (!res.ok) {
    if (res.status === 401) throw new Error("登入已過期");
    if (res.status === 403) {
        localStorage.removeItem('current_cs_id'); // 權限錯就清掉重建
        throw new Error("對話權限錯誤，請重新整理");
    }
    throw new Error(`伺服器錯誤: ${res.status}`);
  }

  try {
    const data = JSON.parse(rawText);
    if (data.success) return sanitizeAnswer(data.reply); // 後端回傳的是 reply
    throw new Error(data.message || "未知錯誤");
  } catch (e) {
    return sanitizeAnswer(rawText); // 如果不是 JSON 就直接回傳文字
  }
}

/* ═══════════════════════════════════════════════════
   ★ UI 邏輯 (配合 callAPI)
   ═══════════════════════════════════════════════════ */
const messagesEl = document.getElementById("messages");
const welcomeEl  = document.getElementById("welcome");
const inputEl    = document.getElementById("userInput");
const sendBtn    = document.getElementById("sendBtn");
const history    = [];

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

function appendMessage(role, text) {
  welcomeEl.style.display = "none";
  const row = document.createElement("div");
  row.className = `row ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  row.innerHTML = `<div class="mini-avatar">${role === "user" ? "你" : "AI"}</div>`;
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showTyping() {
  const row = document.createElement("div");
  row.className = "row bot";
  row.id = "typing-row";
  row.innerHTML = `<div class="mini-avatar">AI</div><div class="bubble typing-bubble"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeTyping() { document.getElementById("typing-row")?.remove(); }

inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 130) + "px";
  sendBtn.disabled = !inputEl.value.trim();
});

inputEl.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
});

sendBtn.addEventListener("click", handleSend);