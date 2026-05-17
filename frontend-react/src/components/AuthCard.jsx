// AuthCard — 登入 / 註冊卡片。
// 串接後端 /api/auth/login、/api/auth/register。

import React from "react";
import * as API from "../lib/api.js";

function HeartMark() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M12 21s-7-4.35-9.5-9.06C.5 7 4 3 7.5 3c2 0 3.5 1 4.5 2.5C13 4 14.5 3 16.5 3 20 3 23.5 7 21.5 11.94 19 16.65 12 21 12 21z" />
    </svg>
  );
}

function BrandHeader() {
  return (
    <div className="auth-brand">
      <div className="auth-disc">
        <HeartMark />
      </div>
      <div className="auth-wordmark">
        Sentient<em>AI</em>
      </div>
      <div className="auth-tag">一個溫暖、安靜的小角落</div>
    </div>
  );
}

function LoginForm({ onLoggedIn, onSwitch }) {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("請輸入帳號與密碼");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const data = await API.login({ username: username.trim(), password });
      if (data.success) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        onLoggedIn(data.user);
      } else {
        setError(data.message || "登入失敗");
      }
    } catch (err) {
      setError(err.response?.data?.message || "無法連線到伺服器，請稍後再試");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <BrandHeader />
      <h2>登入</h2>
      <form onSubmit={submit}>
        <div className="input-group">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="使用者名稱"
            autoComplete="username"
          />
        </div>
        <div className="input-group">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密碼"
            autoComplete="current-password"
          />
        </div>
        <button type="submit" disabled={busy}>{busy ? "登入中…" : "登入"}</button>
        <p className="auth-error">{error}</p>
      </form>
      <div className="auth-switch">
        還沒有帳號？ <a onClick={onSwitch}>註冊</a>
      </div>
    </div>
  );
}

function RegisterForm({ onSwitch }) {
  const [u, setU] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [p1, setP1] = React.useState("");
  const [p2, setP2] = React.useState("");
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!u.trim() || !email.trim() || !p1) {
      setError("請填寫所有欄位");
      return;
    }
    if (p1 !== p2) {
      setError("密碼與確認密碼不符");
      return;
    }
    if (p1.length < 8) {
      setError("密碼至少需要 8 個字元");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const data = await API.register({
        username: u.trim(),
        email: email.trim(),
        password: p1,
      });
      if (data.success) {
        setDone(true);
        setTimeout(onSwitch, 1500);
      } else {
        setError(data.message || "註冊失敗");
      }
    } catch (err) {
      setError(err.response?.data?.message || "無法連線到伺服器，請稍後再試");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <BrandHeader />
      <h2>註冊</h2>
      <form onSubmit={submit}>
        <div className="input-group">
          <input type="text" value={u} onChange={(e) => setU(e.target.value)} placeholder="使用者名稱" />
        </div>
        <div className="input-group">
          <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="電子郵件" />
        </div>
        <div className="input-group">
          <input type="password" value={p1} onChange={(e) => setP1(e.target.value)} placeholder="密碼 (至少 8 字元)" />
        </div>
        <div className="input-group">
          <input type="password" value={p2} onChange={(e) => setP2(e.target.value)} placeholder="確認密碼" />
        </div>
        <button type="submit" disabled={busy}>
          {done ? "註冊成功 ✓" : busy ? "註冊中…" : "註冊"}
        </button>
        <p className="auth-error" style={done ? { color: "var(--sp-success)" } : null}>
          {done ? "請使用新帳號登入" : error}
        </p>
      </form>
      <div className="auth-switch">
        已經有帳號？ <a onClick={onSwitch}>登入</a>
      </div>
    </div>
  );
}

export default function AuthPage({ onLoggedIn }) {
  const [mode, setMode] = React.useState("login");
  return (
    <div className="auth-page">
      {mode === "login" ? (
        <LoginForm onLoggedIn={onLoggedIn} onSwitch={() => setMode("register")} />
      ) : (
        <RegisterForm onSwitch={() => setMode("login")} />
      )}
    </div>
  );
}
