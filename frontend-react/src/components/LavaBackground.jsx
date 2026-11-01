// LavaBackground v7 — hue-wheel emotion color mix.
//
// mixRgb:      [r,g,b] | null — hsl(dispHue, 68%, 60%)，由 App 以 tween 慢慢轉色
// monoOpacity: 0..1 — 單色層濃度；六色層 opacity = 1 - mono * 0.88
// route:       "auth" | "chat"
//
// 六色球顏色來自 app.css 的 .lava-blob.*（不改），單色層只覆寫 background。

import React from "react";

const BLOB_CSS = ["joy", "sad", "anger", "fear", "disgust", "surprise"];

const LAYER_BASE = {
  position: "fixed", inset: 0, zIndex: 0,
  overflow: "hidden", pointerEvents: "none",
};
const FADE = "opacity 1.6s cubic-bezier(0.22,1,0.36,1)";

function SixBlobs({ opacity }) {
  return (
    <div className="lava-bg" aria-hidden="true" style={{ ...LAYER_BASE, opacity, transition: FADE }}>
      {BLOB_CSS.map((k) => <div key={k} className={`lava-blob ${k}`} />)}
    </div>
  );
}

function MonoColorBg({ color, opacity }) {
  const [r, g, b] = color.map((v) => Math.round(Math.max(0, Math.min(255, v))));
  const grad = `radial-gradient(circle, rgb(${r},${g},${b}) 0%, rgba(${r},${g},${b},0.65) 50%, transparent 75%)`;
  return (
    <div aria-hidden="true" style={{ ...LAYER_BASE, background: "transparent", opacity, transition: FADE }}>
      {BLOB_CSS.map((k) => (
        <div key={k} className={`lava-blob ${k}`} style={{ background: grad }} />
      ))}
    </div>
  );
}

export default function LavaBackground({ mixRgb, monoOpacity, route }) {
  const mo = monoOpacity ?? 0;
  if (route === "auth" || mo <= 0 || !mixRgb) {
    return <SixBlobs opacity={1} />;
  }
  return (
    <React.Fragment>
      <SixBlobs opacity={+(1 - mo * 0.88).toFixed(3)} />
      <MonoColorBg color={mixRgb} opacity={mo} />
    </React.Fragment>
  );
}
