// RangeBars — 長期：情緒起伏長條圖（SVG），放在 K 線圖正下方、X 軸對齊。
//
// 每一根 = BAR_MINUTES 分鐘（對應 K 線的 CELLS_PER_BAR 格），高度 = 變化量（calcChange）。
// 變化量 ≥ LARGE_CHANGE_THRESHOLD 為紅色（起伏較大），否則灰色（比較平穩）；直角、不畫圓角。
// 只有 1 則（資料不足）或沒有訊息：位置留空，提示框說明。

import React from "react";
import { CELLS_PER_BAR } from "./calc.js";
import { LARGE_CHANGE_THRESHOLD } from "./constants.js";

export const BARS_H = 96;
const PAD_TOP = 10, PAD_BOT = 6;

function barY(domain) {
  const plotH = BARS_H - PAD_TOP - PAD_BOT;
  return (v) => PAD_TOP + (1 - v / domain.hi) * plotH;
}

export function BarsAxis({ domain, width }) {
  const y = barY(domain);
  return (
    <svg className="et-axis" width={width} height={BARS_H} aria-hidden="true">
      {[0, domain.hi].map((v) => (
        <text key={v} x={width - 6} y={y(v) + 4} textAnchor="end" className="et-axis-text">{v}</text>
      ))}
    </svg>
  );
}

export default function RangeBars({ bars, visible, cellCount, cellW, domain, onTip }) {
  // 只畫和 visible 格子範圍重疊的長條
  const [from, to] = visible;
  const y = barY(domain);
  // 和 K 線圖同寬（最後一根若只涵蓋部分格子，也只畫到最後一格），兩張圖才能同步捲動
  const W = cellCount * cellW;
  const base = y(0);
  const inset = Math.min(cellW * 0.3, 10);

  return (
    <svg width={W} height={BARS_H} viewBox={`0 0 ${W} ${BARS_H}`} style={{ display: "block" }}>
      <line className="et-zero-line" x1={0} x2={W} y1={base} y2={base} />
      <line className="et-threshold-line" x1={0} x2={W}
        y1={y(LARGE_CHANGE_THRESHOLD)} y2={y(LARGE_CHANGE_THRESHOLD)} />

      {bars.map((b, i) => {
        if (b.firstCellIdx + CELLS_PER_BAR <= from || b.firstCellIdx >= to) return null;
        const x0 = b.firstCellIdx * cellW;
        const w = Math.min(CELLS_PER_BAR, cellCount - b.firstCellIdx) * cellW;
        const tipArgs = { kind: "bar", idx: i, center: x0 + w / 2 };
        const top = b.change != null ? y(b.change) : base;
        return (
          <g key={b.start}>
            {b.change != null && (
              <rect className={`et-bar ${b.large ? "is-large" : "is-calm"}${b.live ? " is-live" : ""}`}
                x={x0 + inset} y={Math.min(top, base - 1.5)} width={Math.max(2, w - inset * 2)}
                height={Math.max(1.5, base - top)} />
            )}
            <rect x={x0} y={0} width={w} height={BARS_H} fill="transparent"
              onMouseEnter={() => onTip(tipArgs)} onMouseLeave={() => onTip(null)}
              onClick={(e) => { e.stopPropagation(); onTip(tipArgs, true); }} />
          </g>
        );
      })}
    </svg>
  );
}
