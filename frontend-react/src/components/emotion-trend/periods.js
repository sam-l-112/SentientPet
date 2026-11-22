// periods.js — 中、長期情緒：把情緒分析紀錄依時間切成固定長度的時段。
//
// buildPeriods(history, minutes) → [{ start, end, entries, slots, avg, raw }, ...]
//   - 時段從第一筆分析的時間起算，每 minutes 分鐘一段；沒有任何紀錄的時段不列出
//   - slots：時段內每 1 分鐘一格 { start, count, avg, high, low }（沒有紀錄的分鐘 count = 0）
//   - avg / raw：整個時段的綜合分數平均與六種情緒平均
// 時間以 history 的 analyzedAt（Emotion_Tracker.analyzed_at）為準。

import { EMOTIONS_META } from "../../lib/theme.js";

const MINUTE = 60 * 1000;
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

export function buildPeriods(history, minutes) {
  const pts = history
    .filter((h) => h.analyzedAt != null)
    .sort((a, b) => a.analyzedAt - b.analyzedAt);
  if (!pts.length) return [];

  const t0 = pts[0].analyzedAt;
  const len = minutes * MINUTE;
  const groups = new Map();
  pts.forEach((h) => {
    const k = Math.floor((h.analyzedAt - t0) / len);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(h);
  });

  return [...groups.keys()].sort((a, b) => a - b).map((k) => {
    const start = t0 + k * len;
    const entries = groups.get(k);
    const slots = Array.from({ length: minutes }, (_, m) => {
      const scores = entries
        .filter((h) => Math.floor((h.analyzedAt - start) / MINUTE) === m)
        .map((h) => h.score);
      if (!scores.length) return { start: start + m * MINUTE, count: 0 };
      return {
        start: start + m * MINUTE,
        count: scores.length,
        avg: Math.round(mean(scores)),
        high: Math.max(...scores),
        low: Math.min(...scores),
      };
    });
    const raw = Object.fromEntries(
      EMOTIONS_META.map((e) => [e.key, Math.round(mean(entries.map((h) => h.raw?.[e.key] ?? 0)))])
    );
    return { start, end: start + len, entries, slots, avg: Math.round(mean(entries.map((h) => h.score))), raw };
  });
}

export const hhmm = (ms) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
