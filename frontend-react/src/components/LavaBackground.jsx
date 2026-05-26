// LavaBackground v6 — weighted emotion color mix.
//
// mixColor: [r,g,b] — computed weighted average of active emotions
// monoOpacity: 0..1 — how much the mono layer shows vs. six-color
// route: "auth" | "chat"

import React from "react";

const BLOB_CSS = ["joy", "sad", "anger", "fear", "disgust", "surprise"];

const LAYER_BASE = {
  position: "fixed", inset: 0, zIndex: 0,
  overflow: "hidden", pointerEvents: "none",
};

function SixBlobs({ opacity }) {
  return (
    <div className="lava-bg"
      style={{ ...LAYER_BASE, opacity, transition: "opacity 1.6s cubic-bezier(0.22,1,0.36,1)" }}>
      {BLOB_CSS.map(k => <div key={k} className={`lava-blob ${k}`} />)}
    </div>
  );
}

function MonoColorBg({ color, opacity }) {
  if (!color) return null;
  const [r, g, b] = color.map(v => Math.round(Math.max(0, Math.min(255, v))));
  const grad = `radial-gradient(circle, rgb(${r},${g},${b}) 0%, rgba(${r},${g},${b},0.65) 50%, transparent 75%)`;
  return (
    <div style={{ ...LAYER_BASE, background: "transparent",
                  opacity, transition: "opacity 1.6s cubic-bezier(0.22,1,0.36,1)" }}>
      {BLOB_CSS.map(k => (
        <div key={k} className={`lava-blob ${k}`} style={{ background: grad }} />
      ))}
    </div>
  );
}

export default function LavaBackground({ mixColor, monoOpacity, route }) {
  const mo = monoOpacity ?? 0;
  if (route === "auth" || mo <= 0 || !mixColor) {
    return <SixBlobs opacity={1} />;
  }
  const sixOp = +(1 - mo * 0.88).toFixed(3);
  return (
    <React.Fragment>
      <SixBlobs opacity={sixOp} />
      <MonoColorBg color={mixColor} opacity={mo} />
    </React.Fragment>
  );
}
