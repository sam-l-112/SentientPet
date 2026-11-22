// CandleChart — 中期：情緒走勢 K 線圖（SVG）。
//
// 每一格 = CELL_MINUTES 分鐘：直角方框頂 = 最高分、底 = 最低分，中間橫線 = 平均。
// 只有 1 則時方框縮成一條橫線；沒有訊息的格子畫淡色虛線外框（空白格）；
// 進行中的格子用較淡的樣式。顏色固定用色票中的紫色（紅色只留給長條圖的「起伏較大」）。

import React from "react";

export const CANDLE_H = 180;
const PAD_TOP = 12, PAD_BOT = 24;

export function candleY(domain) {
  const plotH = CANDLE_H - PAD_TOP - PAD_BOT;
  return (v) => PAD_TOP + (1 - (v - domain.lo) / (domain.hi - domain.lo)) * plotH;
}

export function CandleAxis({ domain, width }) {
  const y = candleY(domain);
  return (
    <svg className="et-axis" width={width} height={CANDLE_H} aria-hidden="true">
      {domain.ticks.map((v) => (
        <text key={v} x={width - 6} y={y(v) + 4} textAnchor="end" className="et-axis-text">{v}</text>
      ))}
    </svg>
  );
}

export default function CandleChart({ cells, cellW, domain, labelEvery, onTip, empty, emptyText }) {
  const y = candleY(domain);
  const W = cells.length * cellW;
  const top = y(domain.hi), bottom = y(domain.lo);
  const boxW = Math.max(4, cellW * 0.56);

  return (
    <svg width={W} height={CANDLE_H} viewBox={`0 0 ${W} ${CANDLE_H}`} style={{ display: "block" }}>
      {domain.ticks.map((v) => (
        <line key={v} x1={0} x2={W} y1={y(v)} y2={y(v)}
          className={v === 0 ? "et-zero-line" : "et-grid-line"} />
      ))}

      {cells.map((c, i) => {
        const x0 = i * cellW;
        const bx = x0 + (cellW - boxW) / 2;
        const tipArgs = { kind: "candle", idx: i, center: x0 + cellW / 2 };
        let body;
        if (!c.count) {
          body = (
            <rect className={`et-cell-empty${c.live ? " is-live" : ""}`}
              x={x0 + 2} y={top} width={Math.max(0, cellW - 4)} height={bottom - top} />
          );
        } else {
          const yh = y(c.high), yl = y(c.low), ya = y(c.avg);
          body = (
            <g className={`et-candle${c.live ? " is-live" : ""}`}>
              {c.high === c.low
                ? <line className="et-candle-flat" x1={bx} x2={bx + boxW} y1={ya} y2={ya} />
                : <rect className="et-candle-box" x={bx} y={yh} width={boxW} height={yl - yh} />}
              <line className="et-candle-avg" x1={bx} x2={bx + boxW} y1={ya} y2={ya} />
            </g>
          );
        }
        return (
          <g key={c.start}>
            {body}
            <rect x={x0} y={0} width={cellW} height={CANDLE_H} fill="transparent"
              onMouseEnter={() => onTip(tipArgs)} onMouseLeave={() => onTip(null)}
              onClick={(e) => { e.stopPropagation(); onTip(tipArgs, true); }} />
          </g>
        );
      })}

      {cells.map((c, i) => (i % labelEvery === 0) && (
        <g key={`l${c.start}`} className="et-time-label">
          <line x1={i * cellW} x2={i * cellW} y1={bottom} y2={bottom + 4} className="et-tick" />
          <text x={i * cellW + 2} y={CANDLE_H - 6} textAnchor="start">{c.label}</text>
        </g>
      ))}

      {empty && (
        <text x={W - 8} y={(top + bottom) / 2} textAnchor="end" className="et-empty-text">{emptyText}</text>
      )}
    </svg>
  );
}
