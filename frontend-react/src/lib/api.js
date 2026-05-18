// api.js — 包好 axios + 自動帶 Bearer token + base URL。
// 對應後端 routes：
//   POST /api/auth/login      → { username, password }            ← 公開
//   POST /api/auth/register   → { username, email, password }     ← 公開
//   POST /api/ai/sessions     → { title }                         ← 需 token
//   GET  /api/ai/sessions/:cs_id/messages                         ← 需 token
//   POST /api/ai/sessions/:cs_id/messages → { content }           ← 需 token
//   POST /api/sa              → { cs_id, mes_id, content }        ← 需 token

import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// 自動把 localStorage 裡的 token 塞進 Authorization header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auth ──────────────────────────────────────────────────
export async function login({ username, password }) {
  const { data } = await api.post("/api/auth/login", { username, password });
  return data; // { success, token, user, message }
}

export async function register({ username, email, password }) {
  const { data } = await api.post("/api/auth/register", { username, email, password });
  return data; // { success, message, user_id }
}

// 取得所有 sessions（後端依 updated_at 倒序，[0] 為最新）
export async function getSessions() {
  const { data } = await api.get("/api/ai/sessions");
  return data; // { success, sessions: [{ user_id, cs_id }] }
}

// ── Chat session ──────────────────────────────────────────
export async function createSession(title = "新對話") {
  const { data } = await api.post("/api/ai/sessions", { title });
  return data; // { success, cs_id }
}

export async function getSessionMessages(csId) {
  const { data } = await api.get(`/api/ai/sessions/${csId}/messages`);
  return data; // { success, messages: [{ role, content, message_at }] }
}

export async function sendMessage(csId, content) {
  const { data } = await api.post(`/api/ai/sessions/${csId}/messages`, { content });
  return data; // { success, reply, mes_id, user_mes_id }
}

// ── Sentiment analysis ────────────────────────────────────
export async function analyzeSentiment({ cs_id, mes_id, content }) {
  const { data } = await api.post("/api/sa", { cs_id, mes_id, content });
  return data; // { success, data: { joy, sadness, anger, fear, disgust, surprise, valence, stage } }
}

export async function getEmotionHistory(csId) {
  const { data } = await api.get(`/api/sa/et/${csId}`);
  return data; // { success, history: [{ joy, sadness, anger, fear, disgust, surprise, valence, stage }] }
}

export { API_BASE };
export default api;
