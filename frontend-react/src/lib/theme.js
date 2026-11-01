// theme.js — 情緒混色（色環上混色）與主題色計算。
//
// computeMix(history)  → { hue, mono }   在色環（hue 向量）上混色，不會變灰
// hueToRgb(hue)        → [r,g,b]         hsl(hue, 68%, 60%)，背景單色層 / pill 用
// buildTheme(rgb,mono) → { grad, deep, … } 全 UI 主題色
// applyTheme(theme)    → 寫入 CSS 變數 --theme-*（app.css 使用）

export const EMOTIONS_META = [
  { key: "joy",      label: "快樂", color: "#FAC000" },
  { key: "sadness",  label: "悲傷", color: "#378ADD" },
  { key: "anger",    label: "憤怒", color: "#E24B4A" },
  { key: "fear",     label: "恐懼", color: "#7F77DD" },
  { key: "disgust",  label: "厭惡", color: "#1D9E75" },
  { key: "surprise", label: "驚訝", color: "#EC8B23" },
];

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

export function hslToRgb(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

export const hueToRgb = (hue) => (hue == null ? null : hslToRgb(hue / 360, 0.68, 0.6));

// ── 分數 / 階段（階段一律由分數決定） ──────────────────
export const valenceOf = (r) =>
  Math.min(100, Math.max(0, Math.round(
    ((r.joy ?? 0) * 1.5 - (r.sadness ?? 0) - (r.anger ?? 0) - (r.fear ?? 0) - (r.disgust ?? 0)
      + (r.surprise ?? 0) * 0.5 + 150) / 4
  )));
export const stageOf = (v) => (v >= 67 ? "positive" : v <= 33 ? "negative" : "neutral");

// ── 色環混色 ──────────────────────────────────────────
const EMOTION_HUE = Object.fromEntries(
  EMOTIONS_META.map((e) => [e.key, rgbToHsl(hexRgb(e.color))[0] * 360])
);

// 依序套用每筆分析：取 ≥25 的前兩名，以分數加權單位向量，EMA 0.7/0.3
export function computeMix(history) {
  let v = null, mono = 0;
  history.forEach(({ raw }) => {
    const active = Object.keys(EMOTION_HUE)
      .filter((k) => (raw[k] ?? 0) >= 25)
      .sort((x, y) => raw[y] - raw[x])
      .slice(0, 2);
    if (!active.length) { mono = Math.max(0, +(mono - 0.3).toFixed(3)); return; }
    let x = 0, y = 0;
    active.forEach((k) => {
      const rad = (EMOTION_HUE[k] * Math.PI) / 180;
      x += Math.cos(rad) * raw[k];
      y += Math.sin(rad) * raw[k];
    });
    const n = Math.hypot(x, y) || 1;
    x /= n; y /= n;
    v = !v ? [x, y] : [v[0] * 0.7 + x * 0.3, v[1] * 0.7 + y * 0.3];
    mono = Math.min(1, +(mono + 0.3).toFixed(3));
  });
  const hue = v ? ((Math.atan2(v[1], v[0]) * 180) / Math.PI + 360) % 360 : null;
  return { hue, mono };
}

// ── 主題色 ────────────────────────────────────────────
const CORAL = [201, 132, 99];      // #C98463
const CORAL_DEEP = [182, 106, 72]; // #B66A48
const CREAM = [245, 240, 232];     // #F5F0E8

export function buildTheme(mix, mono) {
  const k = mix ? Math.min(1, mono) : 0;
  const b = CORAL.map((c, i) => Math.round(c + ((mix ? mix[i] : c) - c) * k));
  let d = CORAL_DEEP;
  if (k) {
    let [hh, s0] = rgbToHsl(b);
    if (hh * 360 > 40 && hh * 360 < 70) hh = 36 / 360; // 避免橄欖色
    const sat = Math.max(0.45, Math.min(0.62, s0 + 0.2));
    const hDeg = hh * 360;
    const yellowish = hDeg > 40 && hDeg < 170;
    const bL = yellowish ? 0.33 : hDeg <= 40 ? 0.42 : hDeg < 230 ? 0.38 : 0.46;
    const dL = yellowish ? 0.25 : 0.32;
    b.splice(0, 3, ...hslToRgb(hh, sat, bL));
    d = hslToRgb(hh, sat, dL);
  }
  const tint = (a) => CREAM.map((c, i) => Math.round(c + (b[i] - c) * a * k));
  return {
    base: hex(b),
    deep: hex(d),
    grad: `linear-gradient(135deg, ${hex(b)} 0%, ${hex(d)} 100%)`,
    glow: `0 4px 20px ${rgba(d, 0.3)}`,
    glowLg: `0 8px 32px ${rgba(d, 0.36)}`,
    bubbleShadow: `0 3px 16px ${rgba(d, 0.24)}`,
    soft: rgba(b, 0.16),
    line: rgba(d, 0.42),
    shadowSm: `0 2px 10px ${rgba(d, 0.14)}`,
    hair: k ? rgba(b, 0.26) : "rgba(200,180,220,0.20)",
    inputBorder: k ? rgba(b, 0.42) : "rgba(220,190,235,.4)",
    composerShadow: `0 4px 32px ${rgba(b, 0.16)}`,
    surface: rgba(tint(0.1), 0.55),
    surfaceMain: rgba(tint(0.06), 0.45),
  };
}

const VAR_NAMES = {
  base: "--theme-base", deep: "--theme-deep", grad: "--theme-grad",
  glow: "--theme-glow", glowLg: "--theme-glow-lg", bubbleShadow: "--theme-bubble-shadow",
  soft: "--theme-soft", line: "--theme-line", shadowSm: "--theme-shadow-sm",
  hair: "--theme-hair", inputBorder: "--theme-input-border",
  composerShadow: "--theme-composer-shadow",
  surface: "--theme-surface", surfaceMain: "--theme-surface-main",
};

export function applyTheme(t) {
  const st = document.documentElement.style;
  for (const [k, name] of Object.entries(VAR_NAMES)) st.setProperty(name, t[k]);
}

export function clearTheme() {
  const st = document.documentElement.style;
  for (const name of Object.values(VAR_NAMES)) st.removeProperty(name);
}

// ── 時間格式 ──────────────────────────────────────────
export function formatTime(input) {
  const d = input == null ? new Date() : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("zh-TW", { hour: "numeric", minute: "2-digit" });
}
