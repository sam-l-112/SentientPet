// ChatShell — header + messages + composer（Chat v2）。
//
// - 置中單欄（760px），AI 回覆有標誌 + 對話框 + 時間 / 回覆秒數
// - 使用者訊息 hover 顯示「情緒為：XX　時間」；第 n 則使用者訊息 ↔ history[n]
// - 自動捲到底（ResizeObserver），只有使用者在底部附近時才捲
// - ref.scrollToUserMessage(i)：給 EmotionPanel 折線圖點擊跳轉 + 高亮
//
// 主題色全部走 app.css 的 var(--theme-*)；只有 pill 需要 mixRgb / mono 做混色背景。

import React from "react";
import { EMOTIONS_META, stageOf } from "../lib/theme.js";

const HEART = "M12 21s-7-4.35-9.5-9.06C.5 7 4 3 7.5 3c2 0 3.5 1 4.5 2.5C13 4 14.5 3 16.5 3 20 3 23.5 7 21.5 11.94 19 16.65 12 21 12 21z";
const LOGOUT = "M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z";
const STAGE_NAME = { positive: "正面", neutral: "中性", negative: "負面" };

function EmotionPill({ history, analyzing, mixRgb, mono, onClick }) {
  const last = history.length ? history[history.length - 1] : null;
  const stage = last ? stageOf(last.score) : "neutral";
  const style = mixRgb
    ? (() => {
        const [r, g, b] = mixRgb;
        return {
          background: `linear-gradient(135deg, rgba(255,255,255,.75), rgba(${r},${g},${b},${(0.25 + mono * 0.3).toFixed(2)}))`,
          borderColor: `rgba(${r},${g},${b},.6)`,
          boxShadow: `0 2px 12px rgba(${r},${g},${b},.3)`,
        };
      })()
    : undefined;
  return (
    <button className="emotion-pill" style={style} onClick={onClick} title="情緒分析">
      <span>情緒 · {STAGE_NAME[stage]}</span>
      {analyzing && <span className="emotion-pill-pulse" />}
    </button>
  );
}

function ChatHeader({ username, onLogout, pill }) {
  return (
    <header className="header">
      <div className="header-left">
        <div className="header-info">
          <h1>SentientAI · 心靈陪伴</h1>
        </div>
      </div>
      <div className="header-actions">
        <span className="header-username">{username}</span>
        <button className="btn-logout-icon" onClick={onLogout} title="登出" aria-label="登出">
          <svg viewBox="0 0 24 24"><path d={LOGOUT} /></svg>
        </button>
        {pill}
      </div>
    </header>
  );
}

function Lines({ text }) {
  return String(text).split("\n").filter((l) => l.trim() !== "").map((line, i) => (
    <p key={i}>{line}</p>
  ));
}

function BotMark() {
  return (
    <div className="bot-head">
      <div className="bot-mark">
        <svg viewBox="0 0 24 24"><path d={HEART} /></svg>
      </div>
      <span className="bot-name">SentientAI</span>
    </div>
  );
}

function dominantEmotion(raw) {
  return EMOTIONS_META.reduce(
    (best, e) => ((raw[e.key] ?? 0) > (raw[best.key] ?? 0) ? e : best),
    EMOTIONS_META[0]
  );
}

function UserMessage({ m, userIdx, entry, pending, flash }) {
  const dom = entry ? dominantEmotion(entry.raw) : null;
  return (
    <div className={`msg-user${flash ? " is-flash" : ""}`} data-user-msg={userIdx}>
      <div className="bubble-user"><Lines text={m.content} /></div>
      <div className="msg-user-meta">
        {dom && (
          <span className="meta-emo">
            <span className="meta-emo-dot" style={{ background: dom.color }} />
            情緒為：<b style={{ color: dom.color }}>{dom.label}</b>
          </span>
        )}
        {!dom && pending && <span>情緒分析中…</span>}
        {m.time && <span>{m.time}</span>}
      </div>
    </div>
  );
}

function BotMessage({ m }) {
  return (
    <div className="msg-bot">
      <BotMark />
      <div className="bubble-bot"><Lines text={m.content} /></div>
      {(m.time || m.elapsed) && (
        <div className="msg-bot-meta">
          {m.time && <span>{m.time}</span>}
          {m.time && m.elapsed && <span className="meta-sep" />}
          {m.elapsed && <span>回覆 {m.elapsed} 秒</span>}
        </div>
      )}
    </div>
  );
}

function Typing() {
  return (
    <div className="msg-bot">
      <BotMark />
      <div className="bubble-bot typing-bubble">
        <span className="dot"></span>
        <span className="dot"></span>
        <span className="dot"></span>
      </div>
    </div>
  );
}

function Welcome() {
  return (
    <div className="welcome">
      <div className="welcome-disc">
        <svg viewBox="0 0 24 24"><path d={HEART} /></svg>
      </div>
      <p>說點什麼吧，我在這裡。</p>
    </div>
  );
}

function Composer({ onSend, disabled }) {
  const [v, setV] = React.useState("");
  const [listening, setListening] = React.useState(false);
  const recognitionRef = React.useRef(null);
  const ref = React.useRef(null);

  function autoresize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(160, el.scrollHeight) + "px";
  }

  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("此瀏覽器不支援語音輸入"); return; }
    const rec = new SR();
    rec.lang = "zh-TW";
    rec.interimResults = true;
    rec.onstart = () => setListening(true);
    rec.onend = () => {
      setListening(false);
      setV((prev) => prev.replace(/﻿.*$/, "").trim());
      setTimeout(autoresize, 0);
    };
    rec.onresult = (e) => {
      let final = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      setV((prev) => {
        const base = prev.replace(/﻿.*$/, "");
        return (base + final + "﻿" + interim).slice(0, 2000);
      });
      setTimeout(autoresize, 0);
    };
    rec.onerror = (e) => { console.log("錯誤:", e.error); setListening(false); };
    recognitionRef.current = rec;
    rec.start();
  }

  function stopVoice() { recognitionRef.current?.stop(); }

  function go() {
    const text = v.trim();
    if (!text || disabled) return;
    onSend(text);
    setV("");
    setTimeout(autoresize, 0);
  }

  return (
    <div className="input-bar">
      <div className="input-wrap">
        <textarea
          ref={ref}
          rows={1}
          maxLength={2000}
          placeholder="輸入訊息…"
          value={v}
          onChange={(e) => { setV(e.target.value); autoresize(); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(); }
          }}
        />
        <button
          className={`mic-btn${listening ? " mic-active" : ""}`}
          onClick={listening ? stopVoice : startVoice}
          disabled={disabled}
          title={listening ? "停止錄音" : "語音輸入"}
        >
          <svg viewBox="0 0 24 24">
            <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 17.93V21h-2v2h6v-2h-2v-2.07A8.001 8.001 0 0 0 20 11h-2a6 6 0 0 1-12 0H4a8.001 8.001 0 0 0 7 7.93z" />
          </svg>
        </button>
        <button className="send-btn" onClick={go} disabled={disabled || !v.trim()}>
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
        </button>
      </div>
      <div className="input-hint">Enter 送出 · Shift + Enter 換行</div>
    </div>
  );
}

const ChatShell = React.forwardRef(function ChatShell(
  { username, messages, history, sending, analyzing, onSend, onLogout,
    panelOpen, onTogglePanel, mixRgb, mono },
  ref
) {
  const scrollerRef = React.useRef(null);
  const contentRef = React.useRef(null);
  const stickRef = React.useRef(true);
  const flashTimer = React.useRef(null);
  const [flashIdx, setFlashIdx] = React.useState(null);

  const scrollBottom = React.useCallback((smooth) => {
    requestAnimationFrame(() => {
      const el = scrollerRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    });
  }, []);

  // 內容高度變化 → 若使用者在底部附近就捲到底
  React.useEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    const ro = new ResizeObserver(() => { if (stickRef.current) scrollBottom(true); });
    ro.observe(node);
    return () => ro.disconnect();
  }, [scrollBottom]);

  // 首次 mount（含 bootChat 還原歷史）直接跳到底
  React.useEffect(() => { scrollBottom(false); }, [scrollBottom]);

  React.useEffect(() => () => clearTimeout(flashTimer.current), []);

  function onScroll() {
    const el = scrollerRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  React.useImperativeHandle(ref, () => ({
    scrollToUserMessage(i) {
      setFlashIdx(i);
      clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlashIdx(null), 1600);
      const sc = scrollerRef.current;
      const el = sc && sc.querySelector(`[data-user-msg="${i}"]`);
      if (el) {
        stickRef.current = false;
        sc.scrollTo({ top: el.offsetTop - sc.clientHeight / 2 + el.offsetHeight / 2, behavior: "smooth" });
      }
    },
  }), []);

  function handleSend(text) {
    stickRef.current = true;
    onSend(text);
  }

  let userCount = 0;
  return (
    <div className="app">
      <ChatHeader
        username={username}
        onLogout={onLogout}
        pill={!panelOpen && (
          <EmotionPill history={history} analyzing={analyzing} mixRgb={mixRgb} mono={mono} onClick={onTogglePanel} />
        )}
      />
      <div className="messages" ref={scrollerRef} onScroll={onScroll}>
        <div className="messages-col" ref={contentRef}>
          {messages.length === 0 && !sending ? <Welcome /> : null}
          {messages.map((m, i) => {
            if (m.role !== "user") return <BotMessage key={i} m={m} />;
            const ui = userCount++;
            const entry = history[ui] ?? null;
            return (
              <UserMessage
                key={i}
                m={m}
                userIdx={ui}
                entry={entry}
                pending={!entry && analyzing}
                flash={flashIdx === ui}
              />
            );
          })}
          {sending ? <Typing /> : null}
        </div>
      </div>
      <Composer onSend={handleSend} disabled={sending} />
    </div>
  );
});

export default ChatShell;
