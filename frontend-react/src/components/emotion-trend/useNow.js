// useNow — 目前時間。每 TICK_MS 檢查一次，分頁回到前景時立刻更新。
// 格子一律由 Date.now() 推算，所以計時器在背景被降速也不會漏格，回到前景就補齊。

import React from "react";
import { TICK_MS } from "./constants.js";

export default function useNow() {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const update = () => setNow(Date.now());
    const id = setInterval(update, TICK_MS);
    const onVis = () => { if (document.visibilityState === "visible") update(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", update);
    };
  }, []);
  return now;
}
