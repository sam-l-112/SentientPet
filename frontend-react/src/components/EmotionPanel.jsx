// EmotionPanel — 可收合常駐右側欄（Chat v2）。
//
// - 由 App 控制 mount / unmount（無滑入動畫）；× 關閉
// - 左緣拖曳調整寬度：clamp(300, min(760, innerWidth - 360))
// - 折線圖：點擊點 → onJump(i) 跳到該則使用者訊息；滾輪以游標為錨點縮放（1–8x）
// - 雷達固定 218×240；panelW ≥ 400 卡片在右 (2×3)，< 400 卡片在雷達上方 (3×2)
//
// history：[{ score, stage, raw: { joy, sadness, ..., summary }, saElapsed }, ...]

import React from "react";
import { EMOTIONS_META, stageOf } from "../lib/theme.js";

const STAGE = {
  positive: { name: "正面", className: "pos" },
  neutral:  { name: "中性", className: "neu" },
  negative: { name: "負面", className: "neg" },
};
const CARD_ORDER = ["surprise", "joy", "disgust", "sadness", "fear", "anger"];

const H = 180, PAD_X = 18, PAD_Y_TOP = 14, PAD_Y_BOT = 30;

function Sparkline({ scores, selectedIdx, onSelect }) {
  const wrapRef = React.useRef(null);
  const [width, setWidth] = React.useState(0);
  const [zoom, setZoom] = React.useState(1);
  const zoomRef = React.useRef(1);
  const pendingScroll = React.useRef(null);
  const n = scores.length;
  const nRef = React.useRef(n);
  nRef.current = n;

  // 量容器實際寬度
  React.useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const ro = new ResizeObserver(() => setWidth(node.clientWidth));
    ro.observe(node);
    setWidth(node.clientWidth);
    return () => ro.disconnect();
  }, []);

  // 滾輪縮放（必須 passive:false 才能 preventDefault）
  React.useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    function onWheel(e) {
      const count = nRef.current;
      if (count < 3) return;
      e.preventDefault();
      const z0 = zoomRef.current;
      const z1 = Math.max(1, Math.min(8, +(z0 * (e.deltaY < 0 ? 1.18 : 1 / 1.18)).toFixed(3)));
      if (z1 === z0) return;
      const mx = e.clientX - node.getBoundingClientRect().left;
      const base = (node.clientWidth - PAD_X * 2) / (count - 1);
      const dataX = (node.scrollLeft + mx - PAD_X) / (base * z0);
      pendingScroll.current = PAD_X + dataX * base * z1 - mx;
      zoomRef.current = z1;
      setZoom(z1);
    }
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  // zoom 生效後，把游標下的資料點固定住
  React.useLayoutEffect(() => {
    if (pendingScroll.current != null && wrapRef.current) {
      wrapRef.current.scrollLeft = pendingScroll.current;
      pendingScroll.current = null;
    }
  }, [zoom]);

  const W = Math.max(200, width || 366);
  let svg;
  if (!n) {
    svg = (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%" }}>
        <text x={W / 2} y={H / 2} textAnchor="middle" fill="#6A5D7C" fontSize="11" fontFamily="Nunito">
          尚無資料
        </text>
      </svg>
    );
  } else {
    const plotH = H - PAD_Y_TOP - PAD_Y_BOT;
    const step = n > 1 ? ((W - PAD_X * 2) / (n - 1)) * zoom : 0;
    const totalW = Math.max(W, PAD_X * 2 + step * (n - 1));
    const labelEvery = Math.max(1, Math.ceil(22 / Math.max(step, 1)));
    const pts = scores.map((v, i) => [n > 1 ? PAD_X + i * step : totalW / 2, PAD_Y_TOP + (1 - v / 100) * plotH]);
    const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
    const dFill = d + ` L${pts[n - 1][0].toFixed(1)} ${H - PAD_Y_BOT} L${pts[0][0].toFixed(1)} ${H - PAD_Y_BOT} Z`;
    svg = (
      <svg width={totalW} height={H} viewBox={`0 0 ${totalW} ${H}`} style={{ display: "block" }}>
        <defs>
          <linearGradient id="ec-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--theme-base)", stopOpacity: 0.45 }} />
            <stop offset="100%" style={{ stopColor: "var(--theme-base)", stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <line
          x1={PAD_X} x2={totalW - PAD_X}
          y1={PAD_Y_TOP + plotH / 2} y2={PAD_Y_TOP + plotH / 2}
          stroke="#C8BCD8" strokeWidth="1" strokeDasharray="2 4" opacity="0.5"
        />
        <path d={dFill} fill="url(#ec-grad)" />
        <path d={d} fill="none" style={{ stroke: "var(--theme-deep)" }} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => {
          const sel = i === selectedIdx;
          const showLabel = sel || i % labelEvery === 0 || i === n - 1;
          return (
            <g key={i} style={{ cursor: "pointer" }} onClick={() => onSelect(i)}>
              <title>{`第 ${i + 1} 次對話 · ${scores[i]} 分（點擊跳到該則訊息）`}</title>
              <circle cx={p[0]} cy={p[1]} r="11" fill="transparent" />
              {sel && (
                <circle cx={p[0]} cy={p[1]} r="7" strokeWidth="1"
                  style={{ fill: "var(--theme-soft)", stroke: "var(--theme-line)" }} />
              )}
              <circle cx={p[0]} cy={p[1]} r={sel ? 4.5 : 3} strokeWidth={sel ? 1.8 : 1.6}
                style={{ fill: sel ? "var(--theme-deep)" : "#fff", stroke: "var(--theme-deep)" }} />
              {showLabel && (
                <text x={p[0]} y={H - PAD_Y_BOT + 14} textAnchor="middle" fontSize="11" fontFamily="Nunito"
                  fontWeight={sel ? 800 : 600} style={{ fill: sel ? "var(--theme-deep)" : "#6A5D7C" }}>
                  {i + 1}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    );
  }

  return <div className="ec-spark-scroll" ref={wrapRef}>{svg}</div>;
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

function useResize(initial) {
  const [w, setW] = React.useState(initial);
  const [resizing, setResizing] = React.useState(false);
  const start = React.useCallback((e) => {
    e.preventDefault();
    const x0 = e.clientX, w0 = w;
    const move = (ev) => {
      const max = Math.min(760, window.innerWidth - 360);
      setW(Math.round(Math.max(300, Math.min(max, w0 + (x0 - ev.clientX)))));
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setResizing(false);
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    setResizing(true);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }, [w]);
  return [w, resizing, start];
}

export default function EmotionPanel({ history, analyzing, saError, onClose, onJump }) {
  const [selectedIdx, setSelectedIdx] = React.useState(null);
  const [panelW, resizing, startResize] = useResize(420);

  // 新分析進來 → 選最新一筆
  const lenRef = React.useRef(history.length);
  React.useEffect(() => {
    if (history.length !== lenRef.current) {
      setSelectedIdx(history.length ? history.length - 1 : null);
      lenRef.current = history.length;
    }
  }, [history.length]);

  const scores = history.map((h) => h.score);
  const hasData = scores.length > 0;
  const idx = selectedIdx != null && selectedIdx < scores.length ? selectedIdx : hasData ? scores.length - 1 : -1;
  const cur = hasData ? scores[idx] : 50;
  const prev = idx > 0 ? scores[idx - 1] : null;
  const stage = STAGE[hasData ? stageOf(cur) : "neutral"];
  const delta = prev == null ? null : cur - prev;
  const deltaStr = !hasData ? "尚未分析"
    : delta == null ? "首次紀錄"
    : delta > 0 ? `↑ 變化 +${delta}`
    : delta < 0 ? `↓ 變化 ${delta}`
    : "— 變化-不變";

  const raw = hasData ? history[idx].raw : {};
  const saElapsed = hasData ? history[idx].saElapsed : null;
  const summary = hasData ? raw.summary : null;
  const wide = panelW >= 400;

  function jump(i) {
    setSelectedIdx(i);
    onJump?.(i);
  }

  return (
    <div className="emotion-dock" style={{ width: panelW }}>
      <div className="ec-resize" onMouseDown={startResize} title="拖曳調整寬度">
        <div className={`ec-resize-grip${resizing ? " is-active" : ""}`} />
      </div>
      <aside className="emotion-panel">
        <div className="ec-wrap">
          <div className="ec-head">
            <div className="ec-title">情緒分析</div>
            <button className="ec-close" onClick={onClose} title="收起" aria-label="收起">×</button>
          </div>

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
            <Sparkline scores={scores} selectedIdx={idx} onSelect={jump} />
          </div>

          <div className={`ec-radar-row ${wide ? "is-wide" : "is-narrow"}`}>
            <div className="ec-radar-wrap"><Radar data={raw} /></div>
            <div className="ec-emotion-cards">
              {CARD_ORDER.map((k) => {
                const e = EMOTIONS_META.find((x) => x.key === k);
                return (
                  <div key={e.key} className="ec-emotion-card">
                    <div className="ec-emotion-bar" style={{ background: e.color }} />
                    <div className="ec-emotion-label">
                      <span className="ec-emotion-swatch" style={{ background: e.color }}></span>
                      {e.label}
                    </div>
                    <div className="ec-emotion-value">{hasData ? raw[e.key] ?? 0 : "—"}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {summary && <div className="ec-summary">總結：{summary}</div>}

          <div className="ec-hint">
            {analyzing ? (
              <span>
                {"⏳ 情緒分析中…".split("").map((ch, i) => (
                  <span key={i} className="ec-wave" style={{ animationDelay: `${i * 0.08}s` }}>{ch}</span>
                ))}
              </span>
            ) : saError ? "⚠️ 情緒分析服務連線失敗"
              : "點擊折線圖上的點可跳到該則訊息 · 滾輪可縮放"}
            {saElapsed && <div>⏱ 情緒分析時間：{saElapsed} 秒</div>}
          </div>
        </div>
      </aside>
    </div>
  );
}
