// constants.js — 中、長期對話包的可調參數（改這裡即可，不用動元件）。

// K 線圖每一格的分鐘數（格子對齊時鐘：14:00、14:05、14:10…）
export const CELL_MINUTES = 5;

// 長條圖每一根的分鐘數，必須是 CELL_MINUTES 的整數倍
export const BAR_MINUTES = 10;

if (BAR_MINUTES % CELL_MINUTES !== 0) {
  throw new Error("BAR_MINUTES 必須是 CELL_MINUTES 的整數倍");
}

// 一次顯示幾格（12 格 × 5 分鐘 = 1 小時）
export const WINDOW_CELLS = 12;

// 長條圖「起伏較大」門檻：這 10 分鐘的變化量（最高 − 最低）≥ 門檻就顯示紅色。
// 目前分數範圍 0–100，先用範圍的 20%；之後用測試資料的分布校準。
export const LARGE_CHANGE_THRESHOLD = 20;

// K 線圖 Y 軸預設範圍（沿用現有 0–100）；資料超出時自動往外延伸，負數不會被切掉
export const SCORE_MIN = 0;
export const SCORE_MAX = 100;

// 狀態詞切分點（0–100）：≤20 很負面、≤40 偏負面、<60 中性、<80 偏正面、≥80 很正面
export const STATUS_CUTS = { veryLow: 20, low: 40, high: 60, veryHigh: 80 };

// 趨勢句：和前 10 分鐘的平均相比，差距小於這個值算「差不多」
export const TREND_SAME_RANGE = 5;

// 「時間一直在跑」的檢查間隔；格子永遠用 Date.now() 推算，不靠計時器累加
export const TICK_MS = 15 * 1000;

// 第一次進入分頁的導覽是否看過
export const GUIDE_STORAGE_KEY = "sentientpet.emotionTrend.guideSeen";
