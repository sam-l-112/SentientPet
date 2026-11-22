// PeriodChart — 中、長期對話的單一時段圖表（TrendView 使用）。
//
// - mode "line"：每分鐘一個點（該分鐘綜合分數平均），沒有紀錄的分鐘不畫點
// - mode "candle"：每分鐘一根長方形，上下緣為該分鐘綜合分數的最高、最低；
//   只有一筆時畫成細長方形；統一使用主題色，不畫影線
//
// period：buildPeriods() 回傳的其中一個時段

import React from "react";
import { hhmm } from "./periods.js";

const H = 180, PAD_L = 28, PAD_R = 10, PAD_Y_TOP = 14, PAD_Y_BOT = 30;

export default function PeriodChart({ period, mode }) {
  const wrapRef = React.useRef(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const ro = new ResizeObserver(() => setWidth(node.clientWidth));
    ro.observe(node);
    setWidth(node.clientWidth);
    return () => ro.disconnect();
  }, []);

  const W = Math.max(200, width || 366);
  const plotH = H - PAD_Y_TOP - PAD_Y_BOT;
  const y = (v) => PAD_Y_TOP + (1 - v / 100) * plotH;

  let body;
  if (!period) {
    body = (
      <text x={W / 2} y={H / 2} textAnchor="middle" fill="#6A5D7C" fontSize="11" fontFamily="Nunito">
        尚無資料
      </text>
    );
  } else {
    const slots = period.slots;
    const slotW = (W - PAD_L - PAD_R) / slots.length;
    const cx = (i) => PAD_L + slotW * (i + 0.5);
    const labelEvery = slotW < 40 ? 2 : 1;
    const filled = slots.map((s, i) => [s, i]).filter(([s]) => s.count > 0);
    const d = filled.map(([s, i], j) => `${j ? "L" : "M"}${cx(i).toFixed(1)} ${y(s.avg).toFixed(1)}`).join(" ");
    const bw = Math.min(22, slotW * 0.55);

    body = (
      <>
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke="#C8BCD8" strokeWidth="1"
              strokeDasharray={v === 50 ? "2 4" : undefined} opacity={v === 50 ? 0.5 : 0.25} />
            <text x={PAD_L - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fontFamily="Nunito" fill="#6A5D7C">{v}</text>
          </g>
        ))}

        {mode === "line" && filled.length > 1 && (
          <path d={d} fill="none" style={{ stroke: "var(--theme-deep)" }} strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round" />
        )}

        {filled.map(([s, i]) => (
          <g key={i}>
            <title>{mode === "line"
              ? `${hhmm(s.start)} · 平均 ${s.avg} 分 · ${s.count} 則`
              : `${hhmm(s.start)} · 最高 ${s.high} 分 · 最低 ${s.low} 分 · ${s.count} 則`}</title>
            {mode === "line" ? (
              <>
                <circle cx={cx(i)} cy={y(s.avg)} r="10" fill="transparent" />
                <circle cx={cx(i)} cy={y(s.avg)} r="3.5" strokeWidth="1.6"
                  style={{ fill: "#fff", stroke: "var(--theme-deep)" }} />
              </>
            ) : (
              <rect x={cx(i) - bw / 2} width={bw} rx="2"
                y={y(s.high)} height={Math.max(3, y(s.low) - y(s.high))}
                strokeWidth="1.2" style={{ fill: "var(--theme-base)", stroke: "var(--theme-deep)" }} />
            )}
          </g>
        ))}

        {slots.map((s, i) => i % labelEvery === 0 && (
          <text key={i} x={cx(i)} y={H - PAD_Y_BOT + 14} textAnchor="middle" fontSize="10.5" fontFamily="Nunito"
            fontWeight={s.count ? 700 : 500} style={{ fill: s.count ? "var(--theme-deep)" : "#A89BBF" }}>
            {hhmm(s.start)}
          </text>
        ))}
      </>
    );
  }

  return (
    <div className="et-spark-scroll" ref={wrapRef}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>{body}</svg>
    </div>
  );
}
