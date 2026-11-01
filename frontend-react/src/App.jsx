// App.jsx — 主應用：登入流程 + 聊天 + 情緒分析。
//

// 情緒混色（Chat v2）：
//   1. 在色環上混色：每筆分析取 ≥25 的前兩名情緒，以分數加權 hue 單位向量，EMA 0.7/0.3。
//      → computeMix(history) 得 targetHue / mono（重新整理後由 history 重算，不會跳回六色）。
//   2. 沒有任何 ≥25 → mono -0.3（色相不變）；否則 mono +0.3。
//   3. 顯示色相 dispHue 以 rAF 慢慢轉到 targetHue（3200ms、easeInOutCubic、走最短弧）。
//   4. dispHue → 背景單色層 + 全 UI 主題色（CSS 變數 --theme-*）。

// 流程：
//   1. 啟動：讀 getSessions() 還原最新 session + 情緒歷史。
//   2. 使用者送訊息：先存訊息取 user_mes_id → AI 對話與 SA（背景）同時進行；
//      AI 回覆 → sanitize → 顯示（含回覆時間）。後端無 user-messages API 時退回舊流程。
//   3. 登出：清 token + user，保留 current_cs_id 讓下次登入延續。

import React from "react";
import LavaBackground from "./components/LavaBackground.jsx";
import AuthPage from "./components/AuthCard.jsx";
import ChatShell from "./components/ChatShell.jsx";
import EmotionPanel from "./components/EmotionPanel.jsx";
import * as API from "./lib/api.js";
import { sanitizeAnswer, cleanReply } from "./lib/sanitize.js";
import { getTraditionalConverter } from "./lib/opencc.js";
import {
  computeMix, hueToRgb, buildTheme, applyTheme, clearTheme,
  valenceOf, stageOf, formatTime,
} from "./lib/theme.js";

const mkEntry = (raw, saElapsed) => {
  const score = raw.valence != null ? raw.valence : valenceOf(raw);
  return { score, stage: stageOf(score), raw, saElapsed };
};

// dispHue 以最短弧、easeInOutCubic 在 3200ms 內 tween 到 targetHue
function useHueTween(targetHue) {
  const [dispHue, setDispHue] = React.useState(null);
  const dispRef = React.useRef(null);
  React.useEffect(() => {
    if (targetHue == null) { dispRef.current = null; setDispHue(null); return; }
    const from = dispRef.current;
    if (from == null) { dispRef.current = targetHue; setDispHue(targetHue); return; }
    const delta = ((targetHue - from + 540) % 360) - 180;
    if (Math.abs(delta) < 0.01) return;
    const t0 = performance.now(), dur = 3200;
    let raf;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      const h = (from + delta * e + 360) % 360;
      dispRef.current = h;
      setDispHue(h);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [targetHue]);
  return dispHue;
}

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
  const [analyzing, setAnalyzing] = React.useState(false);
  const [saError, setSaError] = React.useState(false);

  const [panelOpen, setPanelOpen] = React.useState(false);
  const chatRef = React.useRef(null);

  // ── 情緒混色 → 背景 + 主題色 ─────────────────────────
  const { hue: targetHue, mono } = React.useMemo(() => computeMix(history), [history]);
  const dispHue = useHueTween(targetHue);
  const mixRgb = hueToRgb(dispHue);
  const theme = React.useMemo(() => buildTheme(mixRgb, mono), [dispHue, mono]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useLayoutEffect(() => {
    if (route === "chat") applyTheme(theme); else clearTheme();
  }, [theme, route]);

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
            time: formatTime(m.created_at ?? m.message_at ?? null),
          })));
        }

        // 還原情緒歷史
        const emotionData = await API.getEmotionHistory(latest.cs_id);
        if (emotionData.success && emotionData.history?.length > 0) {
          // 用同一套 mkEntry / computeMix，重新整理後混色會依歷史重算
          setHistory(emotionData.history.map((r) => mkEntry(r, r.sa_elapsed ?? null)));
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
    setPanelOpen(false);
    setRoute("auth");
  }

  // ── 送訊息 ─────────────────────────────────────────
  async function onSend(text) {
    if (!csId) { console.warn("尚未建立 session"); return; }
    setMessages((m) => [...m, { role: "user", content: text, time: formatTime() }]);
    setSending(true);
    const sendTime = Date.now(); // ← 記錄送出時間

    try {
      // 0. 先存使用者訊息取得 user_mes_id，之後情緒分析與聊天 AI 同時進行
      let userMesId = null;
      try {
        const saved = await API.saveUserMessage(csId, text);
        if (saved.success) userMesId = saved.user_mes_id;
      } catch { /* 後端尚未提供此 API → 退回舊流程（聊天回覆後再做情緒分析） */ }

      // 1. 情緒分析：有 user_mes_id 就立刻啟動（背景執行，不等聊天 AI）
      if (userMesId) runSentiment(text, userMesId);

      // 2. AI 對話（與情緒分析並行）
      const aiData = await API.sendMessage(csId, text, userMesId);
      if (!aiData.success) throw new Error(aiData.message || "AI 回覆失敗");

      let reply = cleanReply(sanitizeAnswer(aiData.reply));
      try { const toTW = getTraditionalConverter(); reply = toTW(reply); }
      catch { /* opencc 失敗就用原文 */ }

      const elapsed = ((Date.now() - sendTime) / 1000).toFixed(1);
      setMessages((m) => [...m, { role: "bot", content: reply, elapsed, time: formatTime() }]);

      // ── AI 回覆顯示後立刻解鎖 composer ──
      setSending(false);

      // 3. 舊流程相容：沒拿到 user_mes_id 才在聊天回覆後補跑情緒分析
      if (!userMesId && aiData.mes_id) runSentiment(text, aiData.mes_id);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "未知錯誤";
      setMessages((m) => [...m, { role: "bot", content: `⚠️ ${msg}`, time: formatTime() }]);
      setSending(false);
    }
  }

  // ── 情緒分析：完全背景執行，不阻塞聊天 ─────────────────
  function runSentiment(text, mesId) {
        const saStartTime = Date.now();
        setSaError(false);
        setAnalyzing(true);
        API.analyzeSentiment({ cs_id: Number(csId), mes_id: mesId, content: text })
          .then((saData) => {
            if (saData.success && saData.data) {
              const raw = saData.data;

              // 混色由 history 重算（computeMix），這裡只要把結果加進 history
              const saElapsed = ((Date.now() - saStartTime) / 1000).toFixed(1);
              setHistory((h) => [...h, mkEntry(raw, saElapsed)]);
            }
          })
          .catch((saErr) => { 
            console.warn("SA 失敗（不影響聊天）:", saErr);
            setSaError(true);
          })
          .finally(() => { setAnalyzing(false); });
  }

  return (
    <>
      <LavaBackground mixRgb={mixRgb} monoOpacity={mono} route={route} />
      {route === "auth" && <AuthPage onLoggedIn={onLoggedIn} />}
      {route === "chat" && (
        <div className="layout">
          <ChatShell
            ref={chatRef}
            username={user ? user.username : ""}
            messages={messages}
            history={history}
            sending={sending}
            analyzing={analyzing}
            onSend={onSend}
            onLogout={onLogout}
            panelOpen={panelOpen}
            onTogglePanel={() => setPanelOpen((o) => !o)}
            mixRgb={mixRgb}
            mono={mono}
          />
          {panelOpen && (
            <EmotionPanel
              history={history}
              analyzing={analyzing}
              saError={saError}
              onClose={() => setPanelOpen(false)}
              onJump={(i) => chatRef.current?.scrollToUserMessage(i)}
            />
          )}
        </div>
      )}
    </>
  );
}
