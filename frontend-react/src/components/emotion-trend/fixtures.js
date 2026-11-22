// fixtures.js — 測試用假資料（只在開發模式使用）。
//
// 在 npm run dev 的網址後加上 ?trendDemo=<名稱>，中、長期分頁就改用假資料：
//   empty     空資料
//   one       只有 1 則
//   negative  有負分數
//   gaps      中間有空格
//   idle      很久沒對話（最後一則在 2 小時前）
//   many      大量訊息（給老師 Demo：最近 3 小時，每分鐘 1–3 則）
// 時間都以「現在」往回推，所以任何時候打開都看得到。

const MIN = 60 * 1000;

// 以固定種子產生可重現的亂數
function rng(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}

const entry = (now, minutesAgo, score) => ({ analyzedAt: now - minutesAgo * MIN, score, raw: {} });

export const FIXTURE_NAMES = ["empty", "one", "negative", "gaps", "idle", "many"];

export function buildFixture(name, now) {
  switch (name) {
    case "empty":
      return [];
    case "one":
      return [entry(now, 2, 58)];
    case "negative":
      return [[48, 30], [44, -12], [41, -38], [33, 10], [31, -27], [22, 5], [18, 42], [9, -5], [3, 20], [1, 35]]
        .map(([m, v]) => entry(now, m, v));
    case "gaps":
      return [[55, 60], [53, 52], [52, 70], [36, 40], [34, 22], [12, 75], [11, 81], [10, 64], [2, 50]]
        .map(([m, v]) => entry(now, m, v));
    case "idle":
      return [[150, 55], [140, 62], [128, 40], [121, 48]].map(([m, v]) => entry(now, m, v));
    case "many": {
      const r = rng(7);
      const out = [];
      let v = 55;
      for (let m = 180; m >= 0; m--) {
        const n = 1 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) {
          // 偶爾大幅起伏，方便看出紅色長條
          const jump = r() < 0.04 ? (r() - 0.5) * 80 : (r() - 0.5) * 4;
          v = Math.max(-20, Math.min(100, v + jump + (55 - v) * 0.03));
          out.push(entry(now, m - k / n, Math.round(v)));
        }
      }
      return out;
    }
    default:
      return null;
  }
}

export function fixtureFromUrl() {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  const name = new URLSearchParams(window.location.search).get("trendDemo");
  return name && FIXTURE_NAMES.includes(name) ? name : null;
}
