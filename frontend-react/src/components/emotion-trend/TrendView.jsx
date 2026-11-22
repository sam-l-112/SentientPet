// TrendView — 「中、長期對話」分頁。
//
// 由上到下：頂部摘要（範圍、目前綜合分數、狀態詞、一句白話趨勢）→「?」使用說明 →
// 中期 K 線圖 → 長期長條圖 → 圖下說明。不顯示六大情緒的數字、圖例和圖。
//
// 獨立包：只用傳入的 history（唯讀，只取 analyzedAt 與 score），不引用單一對話的檔案；
// 樣式在 emotion-trend.css（.et-*），文字在 emotionTrendCopy.js，參數在 constants.js。

import React from "react";
import TrendCharts from "./TrendCharts.jsx";
import Guide, { guideSeen } from "./Guide.jsx";
import useNow from "./useNow.js";
import { buildTimeline, buildSummary, hhmm, CELL_MS } from "./calc.js";
import { WINDOW_CELLS } from "./constants.js";
import { COPY, rangeText } from "./emotionTrendCopy.js";
import { buildFixture, fixtureFromUrl } from "./fixtures.js";

// 計時起點：進入頁面（載入本包）的時間；重新整理後由最早一則訊息補回
const ENTERED_AT = Date.now();

export default function TrendView({ history, active }) {
  const now = useNow();
  const demo = React.useMemo(() => fixtureFromUrl(), []);
  const data = React.useMemo(
    () => (demo ? buildFixture(demo, Date.now()) : history),
    // 假資料只在載入時產生一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [demo, demo ? null : history]
  );

  const timeline = React.useMemo(() => buildTimeline(data, ENTERED_AT, now), [data, now]);
  const summary = buildSummary(timeline, now);

  const windowEnd = timeline.liveCell + CELL_MS;
  const windowStart = windowEnd - WINDOW_CELLS * CELL_MS;

  // 第一次進入分頁時自動開導覽
  const [guideOpen, setGuideOpen] = React.useState(false);
  React.useEffect(() => {
    if (active && !guideSeen()) setGuideOpen(true);
  }, [active]);

  return (
    <div className="et-root">
      <div className="et-summary">
        <div className="et-summary-head">
          <span className="et-summary-range">{rangeText(hhmm(windowStart), hhmm(windowEnd))}</span>
          <button className="et-help" onClick={() => setGuideOpen(true)}
            title={COPY.helpLabel} aria-label={COPY.helpLabel}>?</button>
        </div>
        <div className="et-summary-label">{COPY.scoreLabel}</div>
        <div className="et-summary-value">{summary.current ?? "—"}</div>
        {summary.status && (
          <div className={`et-status is-${summary.status}`}>{COPY.status[summary.status]}</div>
        )}
        <div className="et-trend-text">{summary.current == null ? COPY.empty : COPY.trend[summary.trend]}</div>
        {demo && <div className="et-demo-tag">測試資料：{demo}</div>}
      </div>

      <TrendCharts timeline={timeline} active={active} />

      {guideOpen && <Guide onClose={() => setGuideOpen(false)} />}
    </div>
  );
}
