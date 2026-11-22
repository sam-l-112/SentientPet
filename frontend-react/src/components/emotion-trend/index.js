// 中、長期對話包：EmotionPanel 外殼以 import.meta.glob 自動載入。
import React from "react";
import TrendView from "./TrendView.jsx";
import "./emotion-trend.css";

// 本包只用 history 與 active；其他 props（例如每次重新建立的 onJump）改變時不必重畫，
// 避免主題變色動畫的每一幀都重算中、長期圖表。
const MemoTrendView = React.memo(TrendView, (a, b) => a.history === b.history && a.active === b.active);

export default { key: "period", label: "中、長期對話", order: 2, View: MemoTrendView };
