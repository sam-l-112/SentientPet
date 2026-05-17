// sanitize.js — 清理 AI 回覆，只保留乾淨的繁體中文文字。

export function sanitizeAnswer(text) {
  if (typeof text !== "string") return text;
  let s = text.trim();

  // 1. 去掉 <think>...</think> 區塊
  s = s.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  // 2. 抓「Final Choice:」或「最終選擇:」之後的內容
  const m = s.match(/(?:Final Choice|最終選擇)\s*[:：]\s*([\s\S]*)$/i);
  if (m) s = m[1].trim();

  return s;
}

// cleanReply — 額外清洗顯示層格式：
// 去除動作括號、markdown 標記、emoji、條列符號等視覺雜訊。
export function cleanReply(text) {
  if (typeof text !== "string") return text;
  let s = text;

  // 1. 去掉 （動作描述） 與 (動作描述) — 括號包住的非對話內容
  s = s.replace(/（[^）]{1,60}）/g, "");
  s = s.replace(/\([^)]{1,60}\)/g, "");

  // 2. 去掉 markdown 粗體 **text** → text
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");

  // 3. 去掉 markdown 斜體 *text* → text
  s = s.replace(/\*([^*]+)\*/g, "$1");

  // 4. 去掉條列符號開頭（1. 2. 3. 或 - ）
  s = s.replace(/^\s*\d+[\.\、]\s*/gm, "");
  s = s.replace(/^\s*[-\-\•]\s*/gm, "");

  // 5. 去掉常見 emoji（基本 Unicode emoji block）
  s = s.replace(
    /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FEFF}❤️🐾]/gu,
    ""
  );

  // 6. 去掉行首行尾多餘空白，收攏連續空行
  s = s
    .split("\n")
    .map((line) => line.trim())
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n");

  return s.trim();
}
