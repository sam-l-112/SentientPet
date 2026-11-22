// TrendCharts — K 線圖 + 長條圖（上下對齊、同步左右拖曳）。
//
// - 一次顯示 WINDOW_CELLS 格（1 小時）；新格從右邊出現
// - 可左右拖曳（滑鼠拖曳、觸控滑動、觸控板）看更早的資料；兩張圖同步移動
// - 沒拖曳時自動跟著最新；拖離最新位置時顯示「回到現在」
// - 滑鼠移上方框 / 長條顯示提示框；手機點擊顯示，點空白處關閉

import React from "react";
import CandleChart, { CandleAxis, CANDLE_H } from "./CandleChart.jsx";
import RangeBars, { BarsAxis, BARS_H } from "./RangeBars.jsx";
import { CELLS_PER_BAR, scoreDomain, changeDomain, hhmm } from "./calc.js";
import { WINDOW_CELLS } from "./constants.js";
import {
  COPY, rangeText, candleTip, candleEmptyTip, barTip, barFewTip, barEmptyTip,
} from "./emotionTrendCopy.js";

const AXIS_W = 32;
const TIP_HALF = 125; // 提示框寬度 250px 的一半

function tipText(tip, cells, bars) {
  if (!tip) return null;
  if (tip.kind === "candle") {
    const c = cells[tip.idx];
    if (!c) return null;
    const range = rangeText(hhmm(c.start), hhmm(c.end));
    return c.count ? candleTip({ range, ...c }) : candleEmptyTip({ range, live: c.live });
  }
  const b = bars[tip.idx];
  if (!b) return null;
  const range = rangeText(hhmm(b.start), hhmm(b.end));
  if (!b.count) return barEmptyTip({ range });
  if (b.change == null) return barFewTip({ range });
  return barTip({ range, ...b });
}

function TrendCharts({ timeline, active }) {
  const { cells: rawCells, bars, points } = timeline;
  const cells = React.useMemo(() => rawCells.map((c) => ({ ...c, label: hhmm(c.start) })), [rawCells]);

  const boxRef = React.useRef(null);
  const kRef = React.useRef(null);
  const bRef = React.useRef(null);
  const [width, setWidth] = React.useState(0);
  const [following, setFollowing] = React.useState(true);
  const followRef = React.useRef(true);
  const [tip, setTip] = React.useState(null); // { kind, idx, center, pinned }
  const [scrollLeft, setScrollLeft] = React.useState(0);
  const syncing = React.useRef(false);
  const drag = React.useRef(null);

  // 量寬度（分頁隱藏時寬度為 0，顯示後 ResizeObserver 會再觸發）
  React.useEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    const ro = new ResizeObserver(() => setWidth(node.clientWidth));
    ro.observe(node);
    setWidth(node.clientWidth);
    return () => ro.disconnect();
  }, []);

  const plotW = Math.max(120, (width || 360) - AXIS_W);
  const cellW = plotW / WINDOW_CELLS;
  const labelEvery = cellW >= 44 ? 1 : CELLS_PER_BAR;

  // 只畫畫面內的格子加左右各一個視窗的緩衝（對齊長條邊界），拖曳時再補畫
  const visible = React.useMemo(() => {
    const n = cells.length;
    const first = Math.floor(scrollLeft / cellW) - WINDOW_CELLS;
    const last = Math.ceil((scrollLeft + plotW) / cellW) + WINDOW_CELLS;
    const from = Math.max(0, Math.floor(first / CELLS_PER_BAR) * CELLS_PER_BAR);
    return [from, Math.min(n, Math.max(from, last))];
  }, [scrollLeft, cellW, plotW, cells.length]);
  const kDomain = React.useMemo(() => scoreDomain(points), [points]);
  const bDomain = React.useMemo(() => changeDomain(bars), [bars]);

  const scrollToEnd = React.useCallback((smooth) => {
    [kRef.current, bRef.current].forEach((n) => {
      if (n) n.scrollTo({ left: n.scrollWidth, behavior: smooth ? "smooth" : "auto" });
    });
    // 立刻更新可見範圍（不等 scroll 事件），避免最右邊先空白一下
    if (!smooth && kRef.current) setScrollLeft(kRef.current.scrollLeft);
  }, []);

  // 跟著最新：格子增加、寬度改變或分頁重新顯示時，若沒在看舊資料就捲到最右
  React.useLayoutEffect(() => {
    if (followRef.current) scrollToEnd(false);
  }, [cells.length, cellW, active, scrollToEnd]);

  function onScroll(src, dst) {
    const s = src.current, d = dst.current;
    if (!s) return;
    if (!syncing.current && d && d.scrollLeft !== s.scrollLeft) {
      syncing.current = true;
      d.scrollLeft = s.scrollLeft;
      requestAnimationFrame(() => { syncing.current = false; });
    }
    const atEnd = s.scrollWidth - s.clientWidth - s.scrollLeft < 2;
    followRef.current = atEnd;
    setFollowing(atEnd);
    setScrollLeft(s.scrollLeft);
    if (tip && !tip.pinned) setTip(null);
  }

  // 滑鼠拖曳（觸控用原生捲動）
  function onPointerDown(e) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    drag.current = { x: e.clientX, left: kRef.current?.scrollLeft ?? 0, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 3) d.moved = true;
    if (d.moved && kRef.current) kRef.current.scrollLeft = d.left - dx;
  }
  function onPointerUp() {
    const moved = drag.current?.moved;
    drag.current = null;
    if (moved) { suppressClick.current = true; setTimeout(() => { suppressClick.current = false; }, 0); }
  }
  const suppressClick = React.useRef(false);

  function handleTip(next, pinned = false) {
    if (drag.current?.moved || suppressClick.current) return;
    if (!next) { setTip((t) => (t && t.pinned ? t : null)); return; }
    if (pinned) {
      setTip((t) => (t && t.pinned && t.kind === next.kind && t.idx === next.idx ? null : { ...next, pinned: true }));
    } else {
      setTip((t) => (t && t.pinned ? t : next));
    }
  }

  // 點圖表外面關閉釘選的提示框
  React.useEffect(() => {
    if (!tip?.pinned) return;
    const close = (e) => { if (!boxRef.current?.contains(e.target)) setTip(null); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [tip]);

  const text = tipText(tip, cells, bars);
  // 提示框以游標所在格為中心，左右各留 TIP_HALF 避免超出面板
  const boxW = width || 360;
  const half = Math.min(TIP_HALF, boxW / 2);
  const tipLeft = tip ? Math.min(Math.max(AXIS_W + tip.center - scrollLeft, half), boxW - half) : 0;
  const tipTop = tip ? (tip.kind === "candle" ? 26 : 26 + CANDLE_H + 60) : 0;
  const pointerHandlers = { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp };

  return (
    <div className="et-charts" ref={boxRef} onClick={() => setTip(null)}>
      <div className="et-chart-title">{COPY.candleTitle}</div>
      <div className="et-chart-row">
        <CandleAxis domain={kDomain} width={AXIS_W} />
        <div className="et-scroll" ref={kRef} onScroll={() => onScroll(kRef, bRef)} {...pointerHandlers}
          style={{ height: CANDLE_H }}>
          <CandleChart cells={cells} visible={visible} cellW={cellW} domain={kDomain} labelEvery={labelEvery}
            onTip={handleTip} empty={!points.length} emptyText={COPY.empty} />
        </div>
      </div>
      <div className="et-caption">{COPY.candleCaption}</div>

      <div className="et-chart-title">{COPY.barTitle}</div>
      <div className="et-chart-row">
        <BarsAxis domain={bDomain} width={AXIS_W} />
        <div className="et-scroll" ref={bRef} onScroll={() => onScroll(bRef, kRef)} {...pointerHandlers}
          style={{ height: BARS_H }}>
          <RangeBars bars={bars} visible={visible} cellCount={cells.length} cellW={cellW} domain={bDomain} onTip={handleTip} />
        </div>
      </div>
      <div className="et-caption">{COPY.barCaption}</div>

      {!following && (
        <button className="et-now-btn" onClick={(e) => { e.stopPropagation(); followRef.current = true; setFollowing(true); scrollToEnd(true); }}>
          {COPY.backToNow} →
        </button>
      )}

      {text && (
        <div className={`et-tip${tip.kind === "bar" ? " is-bar" : ""}`} role="tooltip"
          style={{ left: tipLeft, top: tipTop }}>
          {text}
        </div>
      )}
    </div>
  );
}

// timeline 沒變時不重畫（例如主題變色動畫期間）
export default React.memo(TrendCharts);
