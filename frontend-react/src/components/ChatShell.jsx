// ChatShell — header + messages + composer。

import React from "react";

function ChatHeader({ username, onLogout }) {
  return (
    <header className="header">
      <div className="header-left">
        <div className="avatar-ring">
          <svg viewBox="0 0 24 24">
            <path d="M12 21s-7-4.35-9.5-9.06C.5 7 4 3 7.5 3c2 0 3.5 1 4.5 2.5C13 4 14.5 3 16.5 3 20 3 23.5 7 21.5 11.94 19 16.65 12 21 12 21z" />
          </svg>
        </div>
        <div className="header-info">
          <h1>SentientAI · 心靈陪伴</h1>
          <div className="status">
            <span className="status-dot"></span>線上
          </div>
        </div>
      </div>
      <div className="header-actions">
        <span className="header-username">{username}</span>
        <button className="btn-logout" onClick={onLogout}>登出</button>
      </div>
    </header>
  );
}

function Bubble({ role, children, elapsed }) {
  // 把換行轉成段落，讓長文不會黏成一大塊
  const lines = String(children).split("\n").filter(l => l.trim() !== "");
  return (
    <div className={`row ${role}`}>
      <div className="mini-avatar">{role === "user" ? "你" : "AI"}</div>
      <div className="bubble">
        {lines.map((line, i) => (
          <p key={i} style={{ margin: i === 0 ? 0 : "6px 0 0" }}>{line}</p>
        ))}
        {role === "bot" && children.elapsed && (
          <p className="elapsed-time">⏱ 回覆時間：{children.elapsed} 秒</p>
        )}
        {role === "bot" && elapsed && (
          <p className="elapsed-time">⏱ 回覆時間：{elapsed} 秒</p>
        )}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="row bot">
      <div className="mini-avatar">AI</div>
      <div className="bubble typing-bubble">
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
        <svg viewBox="0 0 24 24">
          <path d="M12 21s-7-4.35-9.5-9.06C.5 7 4 3 7.5 3c2 0 3.5 1 4.5 2.5C13 4 14.5 3 16.5 3 20 3 23.5 7 21.5 11.94 19 16.65 12 21 12 21z" />
        </svg>
      </div>
      <p>說點什麼吧，我在這裡。</p>
    </div>
  );
}

function Composer({ onSend, disabled }) {
  const [v, setV] = React.useState("");
  const [listening, setListening] = React.useState(false);
  const recognitionRef = React.useRef(null);
  
  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("此瀏覽器不支援語音輸入"); return; }
    const rec = new SR();
    rec.lang = "zh-TW";
    rec.interimResults = true;
    rec.onstart = () => setListening(true);
    rec.onend = () => {
      setListening(false);
      setV((prev) => prev.replace(/\uFEFF.*$/, "").trim());
      setTimeout(autoresize, 0);
    };
    rec.onresult = (e) => {
      let final = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          final += e.results[i][0].transcript;
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      setV((prev) => {
        const base = prev.replace(/\uFEFF.*$/, "");
        return (base + final + "\uFEFF" + interim).slice(0, 2000);
      });
      setTimeout(autoresize, 0);
    };
    rec.onerror = (e) => { console.log("錯誤:", e.error); setListening(false); }
    recognitionRef.current = rec;
    rec.start();
  }
  
  function stopVoice() {
    recognitionRef.current?.stop();
  }

  const ref = React.useRef(null);

  function autoresize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(90, el.scrollHeight) + "px";
  }

  function go() {
    const text = v.trim();
    if (!text) return;
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
          onChange={(e) => {
            setV(e.target.value);
            autoresize();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              go();
            }
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
          <svg viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function ChatShell({ username, messages, sending, onSend, onLogout }) {
  const scrollerRef = React.useRef(null);
  React.useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, sending]);

  return (
    <div className="app">
      <ChatHeader username={username} onLogout={onLogout} />
      <div className="messages" ref={scrollerRef}>
        {messages.length === 0 && !sending ? <Welcome /> : null}
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} elapsed={m.elapsed}>{m.content}</Bubble>
        ))}
        {sending ? <Typing /> : null}
      </div>
      <Composer onSend={onSend} disabled={sending} />
    </div>
  );
}
