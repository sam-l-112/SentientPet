// App.jsx — 主應用：登入流程 + 聊天 + 情緒分析。
//
// 流程：
//   1. 啟動：讀 localStorage 還原登入 + session（current_cs_id）。
//      沒登入 → 顯示登入頁；有登入但沒 session → 自動建一個新 session。
//   2. 使用者送訊息：
//      a. POST /api/ai/sessions/:cs_id/messages（body: { content }）
//      b. sanitize + 簡轉繁 → 顯示
//      c. POST /api/sa（body: { cs_id, mes_id, content: reply }）
//      d. 把回傳的 valence / stage / 六情緒值 加進 history
//   3. 登出：清 token + user，但保留 current_cs_id 讓下次登入能延續。

import React from "react";
import LavaBackground from "./components/LavaBackground.jsx";
import AuthPage from "./components/AuthCard.jsx";
import ChatShell from "./components/ChatShell.jsx";
import EmotionPanel from "./components/EmotionPanel.jsx";
import * as API from "./lib/api.js";
import { sanitizeAnswer, cleanReply } from "./lib/sanitize.js";
import { getTraditionalConverter } from "./lib/opencc.js";

function readUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [route, setRoute] = React.useState("loading"); // "loading" | "auth" | "chat"
  const [user, setUser] = React.useState(null);
  const [csId, setCsId] = React.useState(null);

  const [messages, setMessages] = React.useState([]);
  const [sending, setSending] = React.useState(false);

  // 情緒分析歷史 [{ score, stage, raw }]
  const [history, setHistory] = React.useState([]);
  const [latest, setLatest] = React.useState(null);
  const [analyzing, setAnalyzing] = React.useState(false);

  // ── 1. 啟動：還原登入狀態 + session ──────────────────
  React.useEffect(() => {
    const token = localStorage.getItem("token");
    const u = readUser();
    if (!token || !u) {
      setRoute("auth");
      return;
    }
    setUser(u);
    bootChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function bootChat() {
    setRoute("chat");
    try {
      // 查該使用者所有 sessions，取最新一筆
      const sessionData = await API.getSessions();
      if (sessionData.success && sessionData.sessions?.length > 0) {
        const latest = sessionData.sessions[0]; // 後端已倒序，[0] 是最新
        setCsId(latest.cs_id);
        localStorage.setItem("current_cs_id", String(latest.cs_id));
        const msgData = await API.getSessionMessages(latest.cs_id);
        if (msgData.success) {
          setMessages(msgData.messages.map((m) => ({
            role: m.role === "user" ? "user" : "bot",
            content: m.content,
          })));
          const emotionData = await API.getEmotionHistory(latest.cs_id);
          if (emotionData.success && emotionData.history?.length > 0) {
            setHistory(emotionData.history.map((r) => ({
              score: Math.round(r.valence ?? 50),
              stage: r.stage ?? "neutral",
              raw: r,
            })));
          }
        }
      } else {
        // 完全沒有 session，才建新的
        const newData = await API.createSession("新對話");
        if (newData.success) {
          setCsId(newData.cs_id);
          localStorage.setItem("current_cs_id", String(newData.cs_id));
        }
      }
    } catch (err) {
      console.error("bootChat 失敗:", err);
    }
  }

  // ── 登入成功 callback ───────────────────────────────
  function onLoggedIn(u) {
    setUser(u);
    bootChat();
  }

  // ── 登出 ───────────────────────────────────────────
  function onLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("current_cs_id");
    setUser(null);
    setMessages([]);
    setHistory([]);
    setLatest(null);
    setRoute("auth");
  }

  // ── 送訊息 ─────────────────────────────────────────
  async function onSend(text) {
    if (!csId) {
      console.warn("尚未建立 session");
      return;
    }
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);
    const sendTime = Date.now(); // ← 記錄送出時間

    try {
      // 1. AI 對話
      const aiData = await API.sendMessage(csId, text);
      if (!aiData.success) throw new Error(aiData.message || "AI 回覆失敗");

      let reply = cleanReply(sanitizeAnswer(aiData.reply));
      try {
        const toTW = getTraditionalConverter();
        reply = toTW(reply);
      } catch { /* opencc 失敗就用原文 */ }

      const elapsed = ((Date.now() - sendTime) / 1000).toFixed(1);
      setMessages((m) => [...m, { role: "bot", content: reply, elapsed }]);

      // ── AI 回覆顯示後立刻解鎖 composer，讓使用者可以繼續打字 ──
      setSending(false);

      // 2. 情緒分析：完全背景執行，不阻塞聊天
      if (aiData.mes_id) {
        const saStartTime = Date.now();
        setAnalyzing(true);
        API.analyzeSentiment({
          cs_id: Number(csId),
          mes_id: aiData.mes_id,
          content: reply,
        })
          .then((saData) => {
            if (saData.success && saData.data) {
              const raw = saData.data;
              const valence = Math.round(
                (raw.joy * 1.5 - raw.sadness - raw.anger - raw.fear - raw.disgust + raw.surprise * 0.5 + 150) / 4
              );
              const computedStage = valence >= 67 ? "positive" : valence <= 33 ? "negative" : "neutral";
              
              setHistory((h) => [
                ...h,
                {
                  score: valence,
                  stage: computedStage,
                  raw,
                  saElapsed: ((Date.now() - saStartTime) / 1000).toFixed(1),
                },
              ]);
              setLatest(raw);
            }
          })
          .catch((saErr) => {
            console.warn("SA 失敗（不影響聊天）:", saErr);
          })
          .finally(() => {
            setAnalyzing(false);
          });
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "未知錯誤";
      setMessages((m) => [...m, { role: "bot", content: `⚠️ ${msg}` }]);
      setSending(false);
    }
  }

  return (
    <>
      <LavaBackground latest={latest} />
      {route === "auth" && <AuthPage onLoggedIn={onLoggedIn} />}
      {route === "chat" && (
        <div className="layout">
          <ChatShell
            username={user ? user.username : ""}
            messages={messages}
            sending={sending}
            onSend={onSend}
            onLogout={onLogout}
          />
          <EmotionPanel history={history} analyzing={analyzing} />
        </div>
      )}
    </>
  );
}
