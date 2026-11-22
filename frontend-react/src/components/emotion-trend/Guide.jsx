// Guide — 3 步導覽。第一次進入分頁自動出現（localStorage 記錄已看過），「?」可隨時重開。

import React from "react";
import { COPY } from "./emotionTrendCopy.js";
import { GUIDE_STORAGE_KEY } from "./constants.js";

export function guideSeen() {
  try { return localStorage.getItem(GUIDE_STORAGE_KEY) === "1"; } catch { return false; }
}

function markSeen() {
  try { localStorage.setItem(GUIDE_STORAGE_KEY, "1"); } catch { /* 無法儲存就下次再顯示 */ }
}

export default function Guide({ onClose }) {
  const [step, setStep] = React.useState(0);
  const steps = COPY.guide;
  const last = step === steps.length - 1;

  function close() {
    markSeen();
    onClose();
  }

  return (
    <div className="et-guide" role="dialog" aria-modal="true" aria-label={COPY.helpLabel}>
      <div className="et-guide-card">
        <div className="et-guide-step">{COPY.guideStep(step + 1, steps.length)}</div>
        <p className="et-guide-text">{steps[step]}</p>
        <div className="et-guide-actions">
          {!last && <button className="et-guide-skip" onClick={close}>{COPY.guideSkip}</button>}
          <button className="et-guide-next" autoFocus
            onClick={() => (last ? close() : setStep(step + 1))}>
            {last ? COPY.guideDone : COPY.guideNext}
          </button>
        </div>
      </div>
    </div>
  );
}
