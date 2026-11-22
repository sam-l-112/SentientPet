// emotionTrendCopy.js — 中、長期對話分頁的所有文字。
// 原則：用股票 K 線比喻，但文字用白話；不出現「漲跌」「均線」「成交量」等股市術語。
// 中文和英文、數字之間不加空格。

export const COPY = {
  candleTitle: "情緒走勢（每5分鐘一格）",
  barTitle: "情緒起伏（每10分鐘一根）",
  candleCaption: "方框頂是這5分鐘最高分、底是最低分，中間橫線是平均",
  barCaption: "紅色代表起伏較大，灰色代表比較平穩",
  empty: "先聊幾句，這裡就會出現你的心情變化",
  backToNow: "回到現在",
  helpLabel: "使用說明",
  scoreLabel: "目前綜合分數",
  live: "進行中",

  guide: [
    "這張圖像股票的K線，但畫的是你的心情。橫軸是時間，每一格5分鐘；縱軸是情緒綜合分數，越高越正面。",
    "每個方框是這5分鐘的心情範圍：方框頂是最高分，方框底是最低分，中間的橫線是平均。這5分鐘沒聊天就會留空。",
    "下面的長條是每10分鐘的起伏：紅色代表這段時間心情起伏較大，灰色代表比較平穩。把滑鼠移上去可以看詳細說明。",
  ],
  guideNext: "下一步",
  guideDone: "我知道了",
  guideSkip: "略過",
  guideStep: (i, n) => `${i}/${n}`,

  status: {
    veryLow: "很負面",
    low: "偏負面",
    mid: "中性",
    high: "偏正面",
    veryHigh: "很正面",
  },

  trend: {
    better: "比10分鐘前好一點",
    same: "和10分鐘前差不多",
    worse: "比10分鐘前低一點",
    none: "還沒有足夠的資料可以比較",
  },
};

// 時間範圍，例如「14:05–14:10」
export const rangeText = (a, b) => `${a}–${b}`;

// K 線提示框
export const candleTip = ({ range, high, low, avg, count, live }) =>
  `${range}${live ? `（${COPY.live}）` : ""} · 最高${high} · 最低${low} · 平均${avg} · 共${count}則`;

// K 線空白格提示
export const candleEmptyTip = ({ range, live }) =>
  `${range}${live ? `（${COPY.live}）` : ""} · 這5分鐘沒有訊息`;

// 長條提示框（含變化量定義）
export const barTip = ({ range, change, high, low, count, large }) =>
  `${range} 起伏${change}分（最高${high}減最低${low}）。起伏幅度是這10分鐘內最高分減最低分，數字越大代表心情起伏越大。目前判斷：${large ? "起伏較大" : "比較平穩"}。共${count}則`;

// 長條資料不足
export const barFewTip = ({ range }) => `${range} 這段只有1則訊息，還看不出起伏`;

// 長條沒有訊息
export const barEmptyTip = ({ range }) => `${range} 這10分鐘沒有訊息`;
