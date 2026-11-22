// calc.js — 中、長期對話的計算（純函式，不碰畫面）。
//
// 只用每筆情緒紀錄的「時間（analyzedAt）」和「綜合分數（score）」。
//
// buildTimeline(history, startedAt, now) → { cells, bars, points, firstCell, liveCell }
//   cells：K 線每一格（對齊時鐘的 CELL_MINUTES 分鐘），沒有訊息的格子 count = 0（空白格）
//   bars ：長條圖每一根（BAR_MINUTES 分鐘，對齊 cells），change = calcChange(該時段分數)
// calcChange(scores)：起伏（變化量）的定義；之後想換成 RMSSD 等，只要改這個函式。

import {
  CELL_MINUTES, BAR_MINUTES, WINDOW_CELLS, SCORE_MIN, SCORE_MAX,
  STATUS_CUTS, TREND_SAME_RANGE, LARGE_CHANGE_THRESHOLD,
} from "./constants.js";

const MIN = 60 * 1000;
export const CELL_MS = CELL_MINUTES * MIN;
export const BAR_MS = BAR_MINUTES * MIN;
export const CELLS_PER_BAR = BAR_MINUTES / CELL_MINUTES;
const TREND_FALLBACK_MS = 30 * MIN;

// 對齊時鐘（各時區偏移都是 15 分鐘的倍數，所以以 epoch 取整等同對齊本地時鐘）
export const floorTo = (ms, size) => Math.floor(ms / size) * size;

const round = (v) => Math.round(v);
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

// 起伏（變化量）：這段時間內最高分減最低分；少於 2 則時無法判斷，回傳 null
export function calcChange(scores) {
  if (scores.length < 2) return null;
  return Math.max(...scores) - Math.min(...scores);
}

function stats(scores) {
  if (!scores.length) return { count: 0 };
  return {
    count: scores.length,
    high: Math.max(...scores),
    low: Math.min(...scores),
    avg: round(mean(scores)),
  };
}

export function toPoints(history) {
  return history
    .filter((h) => h && h.analyzedAt != null && Number.isFinite(h.score))
    .map((h) => ({ t: h.analyzedAt, score: h.score }))
    .sort((a, b) => a.t - b.t);
}

export function buildTimeline(history, startedAt, now) {
  const points = toPoints(history);
  const liveCell = floorTo(now, CELL_MS);
  let lastCell = liveCell;
  if (points.length) lastCell = Math.max(lastCell, floorTo(points[points.length - 1].t, CELL_MS));

  // 起點：進入頁面時；重新整理後由最早一則訊息補回。至少補滿一個視窗（1 小時），
  // 並對齊長條（10 分鐘）讓兩張圖的格子對齊。
  let first = Math.min(startedAt, points.length ? points[0].t : startedAt);
  first = Math.min(floorTo(first, CELL_MS), lastCell - (WINDOW_CELLS - 1) * CELL_MS);
  const firstCell = floorTo(first, BAR_MS);

  const cells = [];
  let p = 0;
  for (let t = firstCell; t <= lastCell; t += CELL_MS) {
    const scores = [];
    while (p < points.length && points[p].t < t + CELL_MS) {
      if (points[p].t >= t) scores.push(points[p].score);
      p++;
    }
    cells.push({ start: t, end: t + CELL_MS, live: t === liveCell, scores, ...stats(scores) });
  }

  const bars = [];
  for (let i = 0; i < cells.length; i += CELLS_PER_BAR) {
    const group = cells.slice(i, i + CELLS_PER_BAR);
    const scores = group.flatMap((c) => c.scores);
    const change = calcChange(scores);
    bars.push({
      start: group[0].start,
      end: group[0].start + BAR_MS,
      firstCellIdx: i,
      live: group.some((c) => c.live),
      ...stats(scores),
      change,
      large: change != null && change >= LARGE_CHANGE_THRESHOLD,
    });
  }

  return { cells, bars, points, firstCell, liveCell };
}

// 狀態詞（5 層）
export function statusOf(score) {
  if (score == null) return null;
  if (score <= STATUS_CUTS.veryLow) return "veryLow";
  if (score <= STATUS_CUTS.low) return "low";
  if (score < STATUS_CUTS.high) return "mid";
  if (score < STATUS_CUTS.veryHigh) return "high";
  return "veryHigh";
}

// 頂部摘要：目前綜合分數 = 進行中這一格的平均；這一格還沒有訊息時用最近一筆。
// 趨勢：和前 10 分鐘（now-20 到 now-10 分鐘）的平均相比；那段沒有資料時，
// 改和 10 分鐘以前、30 分鐘內最近的一筆相比。
export function buildSummary({ cells, points }, now) {
  if (!points.length) return { current: null, status: null, trend: "none" };
  const live = cells.find((c) => c.live);
  const current = live && live.count ? live.avg : points[points.length - 1].score;

  let ref = points.filter((x) => x.t >= now - 2 * BAR_MS && x.t < now - BAR_MS).map((x) => x.score);
  if (!ref.length) {
    // 對話很稀疏時：改用 10 分鐘以前（30 分鐘內）最近的一筆
    const older = points.filter((x) => x.t < now - BAR_MS && x.t >= now - TREND_FALLBACK_MS);
    if (older.length) ref = [older[older.length - 1].score];
  }
  let trend = "none";
  if (ref.length) {
    const diff = current - mean(ref);
    trend = Math.abs(diff) < TREND_SAME_RANGE ? "same" : diff > 0 ? "better" : "worse";
  }
  return { current, status: statusOf(current), trend };
}

// K 線 Y 軸：預設 SCORE_MIN–SCORE_MAX，資料超出時往外延伸到 10 的倍數（負數完整畫出）
export function scoreDomain(points) {
  let lo = SCORE_MIN, hi = SCORE_MAX;
  points.forEach(({ score }) => {
    if (score < lo) lo = Math.floor(score / 10) * 10;
    if (score > hi) hi = Math.ceil(score / 10) * 10;
  });
  const ticks = [...new Set([lo, 0, 50, 100, hi])].filter((v) => v >= lo && v <= hi).sort((a, b) => a - b);
  return { lo, hi, ticks };
}

// 長條圖 Y 軸：自動隨最大變化量調整，至少能看出門檻
export function changeDomain(bars) {
  const max = Math.max(LARGE_CHANGE_THRESHOLD * 1.5, ...bars.map((b) => b.change ?? 0));
  return { hi: Math.ceil(max / 10) * 10 };
}

export const hhmm = (ms) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
