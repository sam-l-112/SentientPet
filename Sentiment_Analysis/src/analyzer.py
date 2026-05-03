from __future__ import annotations

import json
import os
import time
from typing import Any, Callable, Dict, List, Optional

import openai


class AnalyzeError(Exception):
    pass


def _build_client() -> openai.OpenAI:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise AnalyzeError("找不到 OPENROUTER_API_KEY。請在 .env 或環境變數中設定。")

    # OpenAI Python SDK v1: client-level timeout is supported.
    return openai.OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
        timeout=30,
    )


SYSTEM_PROMPT = """
你是一個情緒分析器。你必須「只輸出純 JSON」，不得輸出任何其他文字、markdown、說明、前後綴。
輸出 JSON 必須能被 json.loads 直接解析。

輸出格式固定如下（不要新增欄位、不要改欄位名、不要輸出 null）：
{
  "ekman": {
    "happiness": 0-100,
    "sadness": 0-100,
    "anger": 0-100,
    "fear": 0-100,
    "disgust": 0-100,
    "surprise": 0-100
  },
  "dominant_emotion": "happiness|sadness|anger|fear|disgust|surprise",
  "vad": {
    "valence": -100..100（整數）,
    "arousal": 0..100（整數）,
    "dominance": 0..100（整數）
  },
  "context_shift": "stable|up|down|mixed",
  "summary": "一句話中文解讀"
}
""".strip()


def _safe_json_loads(s: str) -> Dict[str, Any]:
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        # 嘗試從雜訊中擷取第一個 JSON 物件
        start = s.find("{")
        end = s.rfind("}")
        if start != -1 and end != -1 and end > start:
            candidate = s[start : end + 1]
            return json.loads(candidate)
        raise


def analyze_message(
    *,
    text: str,
    history_last10: List[Dict[str, Any]],
    typing: Dict[str, Any],
    # OpenRouter 的 model ID 需要用「供應商/模型:free」這種格式；不要用顯示名稱 "gpt-oss-120b (free)"。
    model: str = "meta-llama/llama-3.3-70b-instruct:free",
    on_retry: Optional[Callable[[str], None]] = None,
) -> Dict[str, Any]:
    """
    呼叫 OpenRouter 進行情緒分析，回傳 dict（已解析 JSON）。
    - API 回傳非 JSON：拋 AnalyzeError（上層要顯示提示，不可崩潰）
    - 超時/限速：顯示「分析中，請稍候...」並自動 retry 一次（由上層印提示）
    """
    client = _build_client()

    payload = {
        "text": text,
        "history_last10": history_last10,
        "typing": typing,
    }

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": json.dumps(payload, ensure_ascii=False),
        },
    ]

    extra_headers = {
        "HTTP-Referer": "http://localhost",
        "X-Title": "Emotion Analyzer",
    }

    last_err: Optional[Exception] = None
    for attempt in range(2):
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=messages,
                extra_headers=extra_headers,
            )
            content = (resp.choices[0].message.content or "").strip()
            if not content:
                raise AnalyzeError("模型回傳內容為空。")

            try:
                data = _safe_json_loads(content)
            except Exception as e:  # noqa: BLE001
                raise AnalyzeError("模型回傳非 JSON，已跳過本次分析。") from e

            return data
        except Exception as e:  # noqa: BLE001
            last_err = e
            # OpenAI SDK 的錯誤型別在不同版本可能不同：用字串特徵做寬鬆判斷
            msg = str(e).lower()
            retryable = any(
                k in msg
                for k in [
                    "timeout",
                    "timed out",
                    "rate limit",
                    "429",
                    "too many requests",
                    "overloaded",
                    "502",
                    "503",
                    "504",
                ]
            )
            if attempt == 0 and retryable:
                if on_retry:
                    try:
                        on_retry("分析中，請稍候...")
                    except Exception:  # noqa: BLE001
                        pass
                time.sleep(1.2)
                continue
            raise AnalyzeError(f"分析失敗：{e}") from e

    raise AnalyzeError(f"分析失敗：{last_err}")
