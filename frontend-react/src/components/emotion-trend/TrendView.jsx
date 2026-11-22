// TrendView — 「中、長期對話」分頁。
//
// - 中期 5 分鐘、長期 10 分鐘時段；圖表可切換折線圖／股市圖；◀ ▶ 切換時段
// - 下方綜合分數、雷達圖、情緒卡片顯示該時段的平均
// - 獨立包：只用 ../../lib/theme.js（唯讀）與傳入的 history；
//   雷達圖、卡片、按鈕都是本包自己的複本，樣式在 emotion-trend.css（.et-*）

import React from "react";
import { EMOTIONS_META, stageOf } from "../../lib/theme.js";
import { buildPeriods, hhmm } from "./periods.js";
import PeriodChart from "./PeriodChart.jsx";

const STAGE = {
  positive: { name: "正面", className: "pos" },
  neutral:  { name: "中性", className: "neu" },
  negative: { name: "負面", className: "neg" },
};
const CARD_ORDER = ["surprise", "joy", "disgust", "sadness", "fear", "anger"];
const PERIODS = [{ min: 5, label: "中期 5 分鐘" }, { min: 10, label: "長期 10 分鐘" }];
const CHARTS = [{ key: "line", label: "折線圖" }, { key: "candle", label: "股市圖" }];

function Seg({ items, value, onChange, className = "" }) {
  return (
    <div className={`et-seg ${className}`}>
      {items.map((it) => (
        <button key={it.key} className={`et-seg-btn${it.key === value ? " is-on" : ""}`}
          onClick={() => onChange(it.key)}>{it.label}</button>
      ))}
    </div>
  );
}

function Radar({ data }) {
  const W = 240, cx = W / 2, cy = W / 2, R = 88, N = EMOTIONS_META.length;
  const ang = (i) => -Math.PI / 2 + (2 * Math.PI * i) / N;
  const pt = (v, i) => { const r = (v / 100) * R; return [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))]; };
  const poly = (ps) => ps.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const dataPts = EMOTIONS_META.map((e, i) => pt(data[e.key] || 0, i));
  return (
    <svg viewBox={`0 0 ${W} ${W}`} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%" }}>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={poly(EMOTIONS_META.map((_, i) => pt(f * 100, i)))} fill="none" stroke="#E8DEF2" strokeWidth="1" />
      ))}
      {EMOTIONS_META.map((e, i) => {
        const [x, y] = pt(100, i);
        return <line key={e.key} x1={cx} y1={cy} x2={x} y2={y} stroke="#E8DEF2" strokeWidth="1" />;
      })}
      {[25, 50, 75, 100].map((v) => {
        const ty = cy - (v / 100) * R;
        return (
          <g key={v}>
            <rect x={cx + 3} y={ty - 7} width="20" height="12" rx="3" fill="#FFFFFF" opacity="0.9" />
            <text x={cx + 13} y={ty + 2} textAnchor="middle" fontSize="11" fontFamily="Nunito" fontWeight="700" fill="#6A5D7C">{v}</text>
          </g>
        );
      })}
      <polygon points={poly(dataPts)} strokeWidth="1.8" strokeLinejoin="round"
        style={{ fill: "var(--theme-soft)", stroke: "var(--theme-deep)" }} />
      {dataPts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill={EMOTIONS_META[i].color} stroke="#fff" strokeWidth="1.4" />
      ))}
      {EMOTIONS_META.map((e, i) => {
        const r = R + 15;
        const x = cx + r * Math.cos(ang(i)), y = cy + r * Math.sin(ang(i));
        return (
          <g key={e.key}>
            <circle cx={x - 15} cy={y} r="3.5" fill={e.color} />
            <text x={x + 4} y={y} dy="4" textAnchor="middle" fontSize="12" fontFamily="Nunito" fontWeight="800"
              fill="#4A3F5C" stroke="#fff" strokeWidth="3" paintOrder="stroke">{e.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function TrendView({ history, analyzing, saError, wide }) {
  const [periodMin, setPeriodMin] = React.useState(5);
  const [chartMode, setChartMode] = React.useState("line");
  const [periodIdx, setPeriodIdx] = React.useState(null); // null = 最新時段

  const periods = React.useMemo(() => buildPeriods(history, periodMin), [history, periodMin]);
  const pIdx = periodIdx != null && periodIdx < periods.length ? periodIdx : periods.length - 1;
  const period = pIdx >= 0 ? periods[pIdx] : null;

  const shown = period != null;
  const cur = !shown ? 50 : period.avg;
  const prev = pIdx > 0 ? periods[pIdx - 1].avg : null;
  const stage = STAGE[shown ? stageOf(cur) : "neutral"];
  const delta = prev == null ? null : cur - prev;
  const deltaStr = !shown ? "尚未分析"
    : delta == null ? "首次紀錄"
    : delta > 0 ? `↑ 變化 +${delta}`
    : delta < 0 ? `↓ 變化 ${delta}`
    : "— 變化-不變";

  const raw = !shown ? {} : period.raw;
  const kpiLabel = !shown ? "最新綜合分數"
    : `${hhmm(period.start)}–${hhmm(period.end)} · 平均綜合分數 · ${period.entries.length} 則`;

  function changePeriodMin(min) {
    setPeriodMin(min);
    setPeriodIdx(null);
  }

  return (
    <>
      <div className="et-period-bar">
        <Seg value={periodMin} onChange={changePeriodMin}
          items={PERIODS.map((p) => ({ key: p.min, label: p.label }))} />
        <Seg value={chartMode} onChange={setChartMode} items={CHARTS} />
      </div>

      {period && (
        <div className="et-period-nav">
          <button className="et-nav-btn" disabled={pIdx <= 0}
            onClick={() => setPeriodIdx(pIdx - 1)} aria-label="上一個時段">◀</button>
          <span className="et-nav-label">{hhmm(period.start)}–{hhmm(period.end)}（{pIdx + 1}/{periods.length}）</span>
          <button className="et-nav-btn" disabled={pIdx >= periods.length - 1}
            onClick={() => setPeriodIdx(pIdx + 1 >= periods.length - 1 ? null : pIdx + 1)} aria-label="下一個時段">▶</button>
        </div>
      )}

      <div className="et-kpi">
        <div className="et-label">{kpiLabel}</div>
        <div className="et-value">{cur}</div>
        <div className={`et-stage ${stage.className}`}>{stage.name}</div>
        <div className="et-change">{deltaStr}</div>
      </div>

      <div className="et-legend">
        {EMOTIONS_META.map((e) => (
          <span key={e.key} className="et-legend-item">
            <span className="et-legend-dot" style={{ background: e.color }}></span>
            {e.label}
          </span>
        ))}
      </div>

      <div className="et-trend-wrap">
        <PeriodChart period={period} mode={chartMode} />
      </div>

      <div className={`et-radar-row ${wide ? "is-wide" : "is-narrow"}`}>
        <div className="et-radar-wrap"><Radar data={raw} /></div>
        <div className="et-emotion-cards">
          {CARD_ORDER.map((k) => {
            const e = EMOTIONS_META.find((x) => x.key === k);
            return (
              <div key={e.key} className="et-emotion-card">
                <div className="et-emotion-bar" style={{ background: e.color }} />
                <div className="et-emotion-label">
                  <span className="et-emotion-swatch" style={{ background: e.color }}></span>
                  {e.label}
                </div>
                <div className="et-emotion-value">{shown ? raw[e.key] ?? 0 : "—"}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="et-hint">
        {analyzing ? (
          <span>
            {"⏳ 情緒分析中…".split("").map((ch, i) => (
              <span key={i} className="et-wave" style={{ animationDelay: `${i * 0.08}s` }}>{ch}</span>
            ))}
          </span>
        ) : saError ? "⚠️ 情緒分析服務連線失敗"
          : chartMode === "line" ? "每個點是 1 分鐘內綜合分數的平均 · ◀ ▶ 切換時段"
          : "每個長方形是 1 分鐘內綜合分數的最高與最低 · ◀ ▶ 切換時段"}
      </div>
    </>
  );
}
