// App.jsx — 主應用：登入流程 + 聊天 + 情緒分析。
//
// 流程：
//   1. 啟動：讀 getSessions() 還原最新 session + 情緒歷史。
//   2. 使用者送訊息：AI → sanitize → 顯示（含回覆時間） → SA（背景）。
//   3. 登出：清 token + user，保留 current_cs_id 讓下次登入延續。

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
  } catch { return null; }
}

function readCsId() {
  const v = localStorage.getItem("current_cs_id");
  return v && v !== "undefined" && v !== "null" ? v : null;
}

export default function App() {
  const [route, setRoute]   = React.useState("loading");
  const [user, setUser]     = React.useState(null);
  const [csId, setCsId]     = React.useState(null);

  const [messages,  setMessages]  = React.useState([]);
  const [sending,   setSending]   = React.useState(false);

  const [history,   setHistory]   = React.useState([]);
  const [latest,    setLatest]    = React.useState(null);
  const [mixColor,  setMixColor]  = React.useState(null);   // [r,g,b]
  const [monoOpacity, setMonoOpacity] = React.useState(0); // 0..1
  const [analyzing, setAnalyzing] = React.useState(false);

  // ── 啟動：還原登入狀態 ───────────────────────────────
  React.useEffect(() => {
    const token = localStorage.getItem("token");
    const u = readUser();
    if (!token || !u) { setRoute("auth"); return; }
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
            elapsed: m.role === "assistant" ? m.reply_elapsed ?? null : null,
          })));
        }

        // 還原情緒歷史
        const emotionData = await API.getEmotionHistory(latest.cs_id);
        if (emotionData.success && emotionData.history?.length > 0) {
          setHistory(emotionData.history.map((r) => {
            const valence = r.valence != null
              ? r.valence
              : Math.min(100, Math.max(0,
                Math.round(
                  (r.joy * 1.5 - r.sadness - r.anger - r.fear - r.disgust + r.surprise * 0.5 + 150) / 4
                )
              ))
            const computedStage = valence >= 67 ? "positive" : valence <= 33 ? "negative" : "neutral";
            return { score: valence, stage: computedStage, raw: r, saElapsed: r.sa_elapsed ?? null };
          }));
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
  function onLoggedIn(u) { setUser(u); bootChat(); }

  // ── 登出 ───────────────────────────────────────────
  function onLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("current_cs_id");
    setUser(null);
    setMessages([]);
    setHistory([]);
    setLatest(null);
    setMixColor(null);
    setMonoOpacity(0);
    setRoute("auth");
  }

  // ── 送訊息 ─────────────────────────────────────────
  async function onSend(text) {
    if (!csId) { console.warn("尚未建立 session"); return; }
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);
    const sendTime = Date.now(); // ← 記錄送出時間

    try {
      // 1. AI 對話
      const aiData = await API.sendMessage(csId, text);
      if (!aiData.success) throw new Error(aiData.message || "AI 回覆失敗");

      let reply = cleanReply(sanitizeAnswer(aiData.reply));
      try { const toTW = getTraditionalConverter(); reply = toTW(reply); }
      catch { /* opencc 失敗就用原文 */ }

      const elapsed = ((Date.now() - sendTime) / 1000).toFixed(1);
      setMessages((m) => [...m, { role: "bot", content: reply, elapsed }]);

      // ── AI 回覆顯示後立刻解鎖 composer ──
      setSending(false);

      // 2. 情緒分析：完全背景執行，不阻塞聊天
      if (aiData.mes_id) {
        const saStartTime = Date.now();
        setAnalyzing(true);
        API.analyzeSentiment({ cs_id: Number(csId), mes_id: aiData.mes_id, content: reply })
          .then((saData) => {
            if (saData.success && saData.data) {
              const raw = saData.data;

              // ── 加權混色邏輯 ────────────────────────────────
              const EMOTION_RGB = {
                joy:      [232, 160,  64],
                sadness:  [ 91, 168, 216],
                anger:    [224,  85,  85],
                fear:     [155, 137, 212],
                disgust:  [123, 194, 138],
                surprise: [232, 200,  74],
              };
              const ekKeys = Object.keys(EMOTION_RGB);
              const active = ekKeys.filter(k => (raw[k] ?? 0) >= 25);
              if (active.length === 0) {
                setMonoOpacity(prev => Math.max(0, +(prev - 0.3).toFixed(3)));
              } else {
                const total = active.reduce((s, k) => s + (raw[k] ?? 0), 0);
                const target = [0,1,2].map(ch =>
                  active.reduce((s, k) => s + EMOTION_RGB[k][ch] * ((raw[k] ?? 0) / total), 0)
                );
                setMixColor(prev => !prev ? target : [
                  prev[0] * 0.7 + target[0] * 0.3,
                  prev[1] * 0.7 + target[1] * 0.3,
                  prev[2] * 0.7 + target[2] * 0.3,
                ]);
                setMonoOpacity(prev => Math.min(1, +(prev + 0.3).toFixed(3)));
              }

              const saElapsed = ((Date.now() - saStartTime) / 1000).toFixed(1);
              const valence = Math.min(100, Math.max(0,
                Math.round(
                  (raw.joy * 1.5 - raw.sadness - raw.anger - raw.fear - raw.disgust + raw.surprise * 0.5 + 150) / 4
                )
              ));
              const computedStage = valence >= 67 ? "positive" : valence <= 33 ? "negative" : "neutral";
              setHistory((h) => [...h, {
                score: valence,
                stage: raw.stage ?? computedStage,
                raw,
                saElapsed,
              }]);
              setLatest(raw);
            }
          })
          .catch((saErr) => { console.warn("SA 失敗（不影響聊天）:", saErr); })
          .finally(() => { setAnalyzing(false); });
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "未知錯誤";
      setMessages((m) => [...m, { role: "bot", content: `⚠️ ${msg}` }]);
      setSending(false);
    }
  }

  return (
    <>
      <LavaBackground mixColor={mixColor} monoOpacity={monoOpacity} route={route} />
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
