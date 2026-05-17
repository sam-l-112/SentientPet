// LavaBackground — 六顆情緒光暈，會跟著最新情緒分數動態大小 / 透明度。

import React from "react";

const KEYS = ["joy", "sadness", "anger", "fear", "disgust", "surprise"];
const CLASS_NAMES = ["joy", "sad", "anger", "fear", "disgust", "surprise"];

function lavaStyle(score) {
  const s = Math.max(0, Math.min(100, score ?? 0));
  const t = s / 100;
  // baseline 0.18 → peak 1.00 ; scale 0.55 → 1.70
  const opacity = 0.18 + t * 0.82;
  const scale = 0.55 + t * 1.15;
  return {
    opacity: opacity.toFixed(3),
    "--sp-lava-scale": scale.toFixed(3),
  };
}

export default function LavaBackground({ latest }) {
  return (
    <div className="lava-bg" aria-hidden="true">
      {CLASS_NAMES.map((klass, i) => {
        const score = latest ? latest[KEYS[i]] : 50;
        return <div key={klass} className={`lava-blob ${klass}`} style={lavaStyle(score)} />;
      })}
    </div>
  );
}
