// opencc.js — 簡轉繁工具（包成一個取得 converter 的 helper）。
// 用法：const toTW = await getTraditionalConverter(); toTW(text);

import { Converter } from "opencc-js";

let _converter = null;

export function getTraditionalConverter() {
  if (!_converter) {
    _converter = Converter({ from: "cn", to: "tw" });
  }
  return _converter;
}
