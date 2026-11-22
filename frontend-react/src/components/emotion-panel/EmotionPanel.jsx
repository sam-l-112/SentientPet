// EmotionPanel（外殼）— 可收合常駐右側欄。
//
// 只負責：拖曳調整寬度、標題 / ×、分頁切換、每個分頁包一層錯誤邊界。
// 不放任何圖表邏輯；分頁內容由各自獨立的包提供：
//   ../emotion-single/  單一對話
//   ../emotion-trend/   中、長期對話
//
// 分頁包以 import.meta.glob 自動載入（../emotion-*/index.js），所以把任一包的資料夾
// 移走，另一包仍能編譯與顯示。每個包的 index.js 匯出：
//   { key, label, order, View }   View props：{ history, analyzing, saError, onJump, wide }
//
// 兩個分頁都保持 mount（非作用中的以 display:none 隱藏），切換分頁時各自的狀態會保留。

import React from "react";
import ErrorBoundary from "./ErrorBoundary.jsx";
import "./emotion-panel.css";

const modules = import.meta.glob("../emotion-*/index.js", { eager: true });
const TABS = Object.values(modules)
  .map((m) => m.default)
  .filter(Boolean)
  .sort((a, b) => a.order - b.order);

function Tabs({ items, value, onChange }) {
  return (
    <div className="ep-seg ep-tabs">
      {items.map((it) => (
        <button key={it.key} className={`ep-seg-btn${it.key === value ? " is-on" : ""}`}
          onClick={() => onChange(it.key)}>{it.label}</button>
      ))}
    </div>
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
  const [panelW, resizing, startResize] = useResize(420);
  const [view, setView] = React.useState(TABS[0]?.key);
  const wide = panelW >= 400;

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

          {TABS.length > 1 && <Tabs items={TABS} value={view} onChange={setView} />}

          {TABS.map(({ key, label, View }) => (
            <div key={key} style={{ display: key === view ? "contents" : "none" }}>
              <ErrorBoundary label={label}>
                <View history={history} analyzing={analyzing} saError={saError} onJump={onJump} wide={wide} />
              </ErrorBoundary>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
