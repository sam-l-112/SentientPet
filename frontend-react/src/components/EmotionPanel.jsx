// EmotionPanel — 綜合分數折線圖 + 雷達圖 + 六格情緒數值。
// 點折線上的點可切換顯示該次對話的雷達 / 數值。
//
// history 結構：[{ score, stage, raw: { joy, sadness, ... } }, ...]
//   score: 0–100，從後端 saData.valence 來
//   stage: 'positive' | 'neutral' | 'negative'（從後端 saData.stage 來）
//   raw:   六大情緒原始分數 0–100

import React from "react";

const EMOTIONS_META = [
  { key: "joy",      label: "快樂", color: "#E24B4A" },
  { key: "sadness",  label: "悲傷", color: "#378ADD" },
  { key: "anger",    label: "憤怒", color: "#D85A30" },
  { key: "fear",     label: "恐懼", color: "#7F77DD" },
  { key: "disgust",  label: "厭惡", color: "#1D9E75" },
  { key: "surprise", label: "驚訝", color: "#BA7517" },
];

function stageLabel(stage) {
  // 後端回傳英文 → 顯示中文
  switch (stage) {
    case "positive": return { name: "正面", className: "pos" };
    case "negative": return { name: "負面", className: "neg" };
    default:         return { name: "中性", className: "neu" };
  }
}

function Sparkline({ scores, selectedIdx, onSelect }) {
  const W = 308, H = 180;
  const PAD_X = 18, PAD_Y_TOP = 14, PAD_Y_BOT = 30;
  const [zoom, setZoom] = React.useState(1);
  const xs = scores.length;
  const scrollRef = React.useRef(null);
  const svgWrapRef = React.useRef(null);
  React.useEffect(() => {
    const el = svgWrapRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  });
  function handleWheel(e) {
    e.preventDefault();
    setZoom(prev => {
      const next = prev + (e.deltaY < 0 ? 0.15 : -0.15);
      return Math.max(1, Math.min(5, +next.toFixed(2)));
    });
    if (e.deltaY < 0) {
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
        }
      }, 0);
    }
  }
  if (xs === 0) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%" }}>
        <text x={W / 2} y={H / 2} textAnchor="middle" fill="#A89BBF" fontSize="11" fontFamily="Nunito">
          尚無資料
        </text>
      </svg>
    );
  }
  const plotH = H - PAD_Y_TOP - PAD_Y_BOT;
  const minStep = xs > 1 ? (W - PAD_X * 2) / (xs - 1) : 0;
  const step = minStep * zoom;
  const totalW = Math.max(W, PAD_X * 2 + step * (xs - 1));
  const pts = scores.map((s, i) => {
    const x = xs > 1 ? PAD_X + i * step : totalW / 2;
    const y = PAD_Y_TOP + (1 - s / 100) * plotH;
    return [x, y];
  });
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const dFill =
    d +
    ` L${pts[pts.length - 1][0].toFixed(1)} ${H - PAD_Y_BOT} L${pts[0][0].toFixed(1)} ${H - PAD_Y_BOT} Z`;
    return (
      <div ref={scrollRef} style={{ overflowX: "auto", width: "100%" }}>
        <div ref={svgWrapRef}>
      <svg viewBox={`0 0 ${totalW} ${H}`}
           style={{ width: Math.max(308, totalW) + "px", height: "100%", display: "block" }}>
      
      <defs>
        <linearGradient id="ec-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#C98463" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#C98463" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line
        x1={PAD_X} x2={W - PAD_X}
        y1={PAD_Y_TOP + plotH / 2} y2={PAD_Y_TOP + plotH / 2}
        stroke="#C8BCD8" strokeWidth="1" strokeDasharray="2 4" opacity="0.5"
      />
      <path d={dFill} fill="url(#ec-grad)" />
      <path d={d} fill="none" stroke="#B66A48" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => {
        const isSel = i === selectedIdx;
        return (
          <g key={i} style={{ cursor: "pointer" }} onClick={() => onSelect(i)}>
            <circle cx={p[0]} cy={p[1]} r="11" fill="transparent" />
            {isSel ? (
              <circle cx={p[0]} cy={p[1]} r="7"
                fill="rgba(182,106,72,0.18)"
                stroke="rgba(182,106,72,0.45)" strokeWidth="1" />
            ) : null}
            <circle cx={p[0]} cy={p[1]} r={isSel ? 4.5 : 3}
              fill={isSel ? "#B66A48" : "#fff"}
              stroke="#B66A48" strokeWidth={isSel ? 1.8 : 1.6} />
            <text x={p[0]} y={H - PAD_Y_BOT + 14}
              textAnchor="middle" fontSize="10" fontFamily="Nunito"
              fontWeight={isSel ? 800 : 600}
              fill={isSel ? "#B66A48" : "#A89BBF"}>
              {i + 1}
            </text>
          </g>
        );
      })}
    </svg>
    </div>
    </div>
  );
}

function Radar({ data }) {
  const W = 240, H = 240, cx = W / 2, cy = H / 2;
  const R = 88;
  const N = EMOTIONS_META.length;
  const angle = (i) => -Math.PI / 2 + (2 * Math.PI * i) / N;
  const pt = (val, i) => {
    const r = (val / 100) * R;
    return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
  };
  const ring = (frac) =>
    EMOTIONS_META.map((_, i) => {
      const r = frac * R;
      return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
    });
  const polyStr = (pts) => pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const dataPts = EMOTIONS_META.map((e, i) => pt(data[e.key] || 0, i));
  const TICKS = [25, 50, 75, 100];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
         style={{ width: "100%", height: "100%" }}>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={polyStr(ring(f))} fill="none" stroke="#E8DEF2" strokeWidth="1" />
      ))}
      {EMOTIONS_META.map((e, i) => {
        const [x, y] = pt(100, i);
        return <line key={e.key} x1={cx} y1={cy} x2={x} y2={y} stroke="#E8DEF2" strokeWidth="1" />;
      })}
      {TICKS.map((v) => {
        const ty = cy - (v / 100) * R;
        return (
          <g key={v}>
            <rect x={cx + 3} y={ty - 7} width="20" height="12" rx="3" fill="#FFFFFF" opacity="0.9" />
            <text x={cx + 13} y={ty + 2} textAnchor="middle"
              fontSize="10" fontFamily="Nunito" fontWeight="700" fill="#A89BBF">
              {v}
            </text>
          </g>
        );
      })}
      <polygon points={polyStr(dataPts)}
        fill="rgba(201,132,99,0.18)"
        stroke="#B66A48" strokeWidth="1.8" strokeLinejoin="round" />
      {dataPts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="3.5"
          fill={EMOTIONS_META[i].color} stroke="#fff" strokeWidth="1.4" />
      ))}
      {EMOTIONS_META.map((e, i) => {
        const r = R + 14;
        const x = cx + r * Math.cos(angle(i));
        const y = cy + r * Math.sin(angle(i));
        return (
          <text key={e.key} x={x} y={y} dy="3" textAnchor="middle"
            fontSize="11" fontFamily="Nunito" fontWeight="700" fill={e.color}>
            {e.label}
          </text>
        );
      })}
    </svg>
  );
}

export default function EmotionPanel({ history, analyzing }) {
  const [selectedIdx, setSelectedIdx] = React.useState(null);

  // 新訊息進來時，自動跳到最新點
  const lenRef = React.useRef(history.length);
  React.useEffect(() => {
    if (history.length !== lenRef.current) {
      setSelectedIdx(history.length ? history.length - 1 : null);
      lenRef.current = history.length;
    }
  }, [history.length]);

  const scores = history.map((h) => h.score);
  const hasData = scores.length > 0;
  const idx =
    selectedIdx != null && selectedIdx < scores.length
      ? selectedIdx
      : hasData
      ? scores.length - 1
      : -1;
  const cur = hasData ? scores[idx] : 50;
  const prev = idx > 0 ? scores[idx - 1] : null;
  const stage = stageLabel(hasData ? history[idx].stage : "neutral");
  const delta = prev == null ? null : cur - prev;
  const deltaStr = !hasData
    ? "尚未分析"
    : delta == null
    ? "首次紀錄"
    : delta > 0
    ? `↑ 變化 +${delta}`
    : delta < 0
    ? `↓ 變化 ${delta}`
    : "— 變化-不變";

  const radarData = hasData ? history[idx].raw : {};
  const saElapsed = hasData ? history[idx].saElapsed : null;
  const summary = hasData ? history[idx].raw.summary : null;

  return (
    <aside className="emotion-panel">
      <div className="ec-wrap">
        <div className="ec-title">情緒分析</div>

        <div className="ec-kpi">
          <div className="ec-label">{hasData ? `第 ${idx + 1} 次對話 · 綜合分數` : "最新綜合分數"}</div>
          <div className="ec-value">{cur}</div>
          <div className={`ec-stage ${stage.className}`}>{stage.name}</div>
          <div className="ec-change">{deltaStr}</div>
        </div>

        <div className="ec-legend">
          {EMOTIONS_META.map((e) => (
            <span key={e.key} className="legend-item">
              <span className="legend-dot" style={{ background: e.color }}></span>
              {e.label}
            </span>
          ))}
        </div>

        <div className="ec-trend-wrap">
          <Sparkline scores={scores} selectedIdx={idx} onSelect={setSelectedIdx} />
        </div>

        <div className="ec-radar-row">
          <div className="ec-radar-wrap">
            <Radar data={radarData} />
          </div>

          <div className="ec-emotion-cards">
            {/* 左欄 surprise/disgust/fear，右欄 joy/sadness/anger */}
            {["surprise", "joy", "disgust", "sadness", "fear", "anger"].map((k) => {
              const e = EMOTIONS_META.find((x) => x.key === k);
              return (
                <div key={e.key} className="ec-emotion-card">
                  <div className="ec-emotion-label" style={{ color: e.color }}>
                    <span className="ec-emotion-swatch" style={{ background: e.color }}></span>
                    {e.label}
                  </div>
                  <div className="ec-emotion-value">{hasData ? radarData[e.key] ?? 0 : "—"}</div>
                </div>
              );
            })}
          </div>
        </div>
        
        {summary && <div className="ec-summary">總結：{summary}</div>}

        <div className="ec-hint">
          {analyzing
            ? (
              <span>
                {"⏳ 情緒分析中…".split("").map((ch, i) => (
                  <span key={i} style={{
                    display: "inline-block",
                    animation: "wave 1.2s ease-in-out infinite",
                    animationDelay: `${i * 0.08}s`,
                  }}>{ch}</span>
                ))}
              </span>
            )
            : "點擊折線圖上的點，可切換到該次對話的雷達圖"}
            {saElapsed && <div>⏱ 情緒分析時間：{saElapsed} 秒</div>}
        </div>
      </div>
    </aside>
  );
}
