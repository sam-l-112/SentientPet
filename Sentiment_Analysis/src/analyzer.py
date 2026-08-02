from __future__ import annotations

import json
import os
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Dict, List, Optional

import openai


class AnalyzeError(Exception):
    """通用分析錯誤"""
    pass


class AnalyzeTimeoutError(AnalyzeError):
    """API 超時錯誤"""
    pass


class AnalyzeInternalError(AnalyzeError):
    """內部伺服器錯誤"""
    pass

# hf and openai setting
def _get_first_env(*keys: str, default: Optional[str] = None) -> Optional[str]:
    for key in keys:
        value = os.getenv(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return default


def _build_client(provider: str = "primary") -> openai.OpenAI:
    provider_name = (provider or "primary").lower()

    if provider_name == "secondary":
        hf_token = _get_first_env("SECONDARY_HF_TOKEN", "HF_TOKEN_2", "HF_TOKEN", "LLM_API_2", "LLM_API_KEY")
        openrouter_key = _get_first_env("SECONDARY_OPENROUTER_API_KEY", "OPENROUTER_API_KEY")
        hf_model_url = _get_first_env(
            "SECONDARY_HF_MODEL_URL",
            "HF_MODEL_URL_2",
            "HF_MODEL_URL",
            "LLM_BASE_URL",
            "LLM_URL_2",
            default="https://router.huggingface.co/v1",
        )
    else:
        hf_token = _get_first_env("HF_TOKEN", "LLM_API_KEY")
        openrouter_key = _get_first_env("OPENROUTER_API_KEY")
        hf_model_url = _get_first_env("HF_MODEL_URL", "LLM_BASE_URL", default="https://router.huggingface.co/v1")

    if hf_token:
        if hf_model_url.endswith("/chat/completions"):
            hf_model_url = hf_model_url[: -len("/chat/completions")]
        hf_model_url = hf_model_url.rstrip("/")
        return openai.OpenAI(
            base_url=hf_model_url,
            api_key=hf_token,
            timeout=90.0,
        )

    if openrouter_key:
        base_url = os.getenv("SECONDARY_OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1") if provider_name == "secondary" else "https://openrouter.ai/api/v1"
        return openai.OpenAI(
            base_url=base_url,
            api_key=openrouter_key,
            timeout=30,
        )

    raise AnalyzeError(
        f"找不到可用的 {provider_name} AI API 設定。請在 .env 或環境變數中設定 HF_TOKEN / OPENROUTER_API_KEY 或其 secondary 版本。"
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


def _has_provider_config(provider: str = "primary") -> bool:
    provider_name = (provider or "primary").lower()
    if provider_name == "secondary":
        return bool(
            _get_first_env("SECONDARY_HF_TOKEN", "HF_TOKEN_2", "HF_TOKEN", "LLM_API_2", "LLM_API_KEY")
            or _get_first_env("SECONDARY_OPENROUTER_API_KEY", "OPENROUTER_API_KEY")
        )
    return bool(
        _get_first_env("HF_TOKEN", "LLM_API_KEY")
        or _get_first_env("OPENROUTER_API_KEY")
    )


def analyze_message(
    *,
    text: str,
    history_last10: List[Dict[str, Any]],
    typing: Dict[str, Any],
    # OpenRouter 的 model ID 需要用「供應商/模型:free」這種格式；不要用顯示名稱 "gpt-oss-120b (free)"。
    model: str = "meta-llama/llama-3.3-70b-instruct:free",
    on_retry: Optional[Callable[[str], None]] = None,
    provider: str = "primary",
) -> Dict[str, Any]:
    """
    呼叫 OpenRouter 進行情緒分析，回傳 dict（已解析 JSON）。
    - API 回傳非 JSON：拋 AnalyzeError（上層要顯示提示，不可崩潰）
    - 超時/限速：顯示「分析中，請稍候...」並自動 retry 一次（由上層印提示）
    """
    client = _build_client(provider=provider)

    hf_token = _get_first_env("HF_TOKEN", "LLM_API_KEY")
    secondary_hf_token = _get_first_env("SECONDARY_HF_TOKEN", "HF_TOKEN_2", "HF_TOKEN", "LLM_API_2", "LLM_API_KEY")
    openrouter_key = _get_first_env("OPENROUTER_API_KEY")
    secondary_openrouter_key = _get_first_env("SECONDARY_OPENROUTER_API_KEY", "OPENROUTER_API_KEY")

    if provider == "secondary":
        if secondary_hf_token and not secondary_openrouter_key:
            model = _get_first_env(
                "SECONDARY_HF_MODEL_NAME_GEMINI",
                "HF_MODEL_NAME_GEMINI",
                "HF_MODEL_NAME_2",
                "HF_MODEL_NAME_SamLowe",
                "LLM_MODEL2",
                "LLM_MODEL",
                default=model,
            ) or model
        elif secondary_openrouter_key:
            pass
    elif hf_token and not openrouter_key:
        model = _get_first_env("HF_MODEL_NAME_GEMINI", "HF_MODEL_NAME_2", "HF_MODEL_NAME_SamLowe", "LLM_MODEL", default=model) or model

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
                timeout=90.0,
            )
            content = (resp.choices[0].message.content or "").strip()
            if not content:
                raise AnalyzeError("模型回傳內容為空。")

            try:
                data = _safe_json_loads(content)
            except Exception as e:  # noqa: BLE001
                raise AnalyzeError("模型回傳非 JSON，已跳過本次分析。") from e

            return data
        except openai.APITimeoutError as e:
            # 明確捕捉 API 超時錯誤
            last_err = e
            if attempt == 0:
                if on_retry:
                    try:
                        on_retry("分析中，請稍候...")
                    except Exception:  # noqa: BLE001
                        pass
                time.sleep(1.2)
                continue
            # 重試後仍然超時，拋出特定的超時異常
            raise AnalyzeTimeoutError(f"API 請求超時：{e}") from e
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

def normalize_emotion_result(result: Dict[str, Any]) -> Dict[str, Any]:
    """確保提取出的 Ekman 與 VAD 數據格式符合規範與預設值"""
    ekman = result.get("ekman", {})
    vad = result.get("vad", {})

    return {
        "ekman": {
            "happiness": float(ekman.get("happiness", 0)),
            "sadness": float(ekman.get("sadness", 0)),
            "anger": float(ekman.get("anger", 0)),
            "fear": float(ekman.get("fear", 0)),
            "disgust": float(ekman.get("disgust", 0)),
            "surprise": float(ekman.get("surprise", 0)),
        },
        "vad": {
            "arousal": float(vad.get("arousal", 50)),
            "dominance": float(vad.get("dominance", 50)),
        },
        "context_shift": str(result.get("context_shift", "stable")),
        "summary": str(result.get("summary", "")),
    }

def average_results(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """計算多個 AI 回傳結果的平均值，並重新計算 dominant_emotion。"""
    if not results:
        raise AnalyzeError("至少需要 1 個分析結果才能進行平均。")

    normalized_results = [normalize_emotion_result(result) for result in results]

    # 1. 計算 Ekman 六大情緒平均值（保留一位小數）
    avg_ekman = {}
    for emotion in ["happiness", "sadness", "anger", "fear", "disgust", "surprise"]:
        total = sum(item["ekman"][emotion] for item in normalized_results)
        avg_ekman[emotion] = round(total / len(normalized_results), 1)

    # 2. 根據平均值選出主要情緒 (Dominant Emotion)
    dominant_emotion = max(avg_ekman, key=avg_ekman.get)

    # 3. 計算 VAD 平均值（符合 prompt 的整數要求）
    avg_vad = {
        "arousal": int(round(sum(item["vad"]["arousal"] for item in normalized_results) / len(normalized_results))),
        "dominance": int(round(sum(item["vad"]["dominance"] for item in normalized_results) / len(normalized_results))),
    }

    # 4. 統整 context_shift 與 summary
    context_values = [item["context_shift"] for item in normalized_results if item.get("context_shift")]
    if context_values and len(set(context_values)) > 1:
        combined_context_shift = "mixed"
    elif context_values:
        combined_context_shift = context_values[0]
    else:
        combined_context_shift = "stable"

    summaries = [item["summary"] for item in normalized_results if item.get("summary")]
    if summaries:
        combined_summary = " | ".join(
            f"[模型{i + 1}]: {summary}" for i, summary in enumerate(summaries)
        )
    else:
        combined_summary = "多 AI 綜合分析完成。"

    return {
        "ekman": avg_ekman,
        "dominant_emotion": dominant_emotion,
        "vad": avg_vad,
        "context_shift": combined_context_shift,
        "summary": combined_summary,
    }


def average_two_results(result_a: Dict[str, Any], result_b: Dict[str, Any]) -> Dict[str, Any]:
    """兼容原有兩個 AI 平均函式。"""
    return average_results([result_a, result_b])


def analyze_with_multiple_ai(
    *,
    text: str,
    history_last10: List[Dict[str, Any]],
    typing: Dict[str, Any],
    models: Optional[List[str]] = None,
    providers: Optional[List[str]] = None,
    on_retry: Optional[Callable[[str], None]] = None,
) -> Dict[str, Any]:
    """
    使用多個 AI 模型同時進行情緒分析並將結果平均。

    - 採用 ThreadPoolExecutor 實現真實併發請求。
    - 若部分模型失敗，仍會以成功模型的結果進行平均，確保穩定性。
    """
    if not models:
        models = []

    if not providers:
        providers = ["primary"] * len(models)
    elif len(providers) < len(models):
        providers = providers + ["primary"] * (len(models) - len(providers))

    if not any(_has_provider_config(provider) for provider in providers):
        raise AnalyzeError("未設定任何可用的 AI API，無法進行多 AI 分析。")

    results: List[Dict[str, Any]] = []
    errors: List[str] = []

    with ThreadPoolExecutor(max_workers=max(1, len(models))) as executor:
        futures = []
        for model, provider in zip(models, providers):
            if not _has_provider_config(provider):
                errors.append(f"[{provider}] 未設定可用 API")
                continue
            futures.append(
                (
                    executor.submit(
                        analyze_message,
                        text=text,
                        history_last10=history_last10,
                        typing=typing,
                        model=model,
                        on_retry=on_retry,
                        provider=provider,
                    ),
                    model,
                )
            )

        for future, model_name in futures:
            try:
                result = future.result()
            except Exception as e:  # noqa: BLE001
                errors.append(f"[{model_name}] 錯誤: {e}")
            else:
                results.append(result)

    if not results:
        raise AnalyzeError(f"多 AI 分析均失敗：\n" + "\n".join(errors))

    if len(results) == 1:
        return results[0]

    return average_results(results)


def analyze_with_two_ai(
    *,
    text: str,
    history_last10: List[Dict[str, Any]],
    typing: Dict[str, Any],
    model_a: str = "meta-llama/llama-3.3-70b-instruct:free",
    model_b: str = "google/gemini-2.0-flash-lite-preview-02-05:free",
    on_retry: Optional[Callable[[str], None]] = None,
    provider_a: str = "primary",
    provider_b: str = "secondary",
) -> Dict[str, Any]:
    """
    使用兩個 AI 模型同時進行情緒分析並將結果平均。

    - 採用 ThreadPoolExecutor 實現真實併發請求。
    - 若單一模型失敗，自動降級回傳成功模型的結果，確保穩定性。
    """
    return analyze_with_multiple_ai(
        text=text,
        history_last10=history_last10,
        typing=typing,
        models=[model_a, model_b],
        providers=[provider_a, provider_b],
        on_retry=on_retry,
    )


def analyze_with_available_ai(
    *,
    text: str,
    history_last10: List[Dict[str, Any]],
    typing: Dict[str, Any],
    model_a: str = "meta-llama/llama-3.3-70b-instruct:free",
    model_b: str = "google/gemini-2.0-flash-lite-preview-02-05:free",
    on_retry: Optional[Callable[[str], None]] = None,
) -> Dict[str, Any]:
    """根據 .env 中是否同時存在兩組 AI 設定，自動決定使用單 AI 或雙 AI 分析。"""
    primary_ready = _has_provider_config("primary")
    secondary_ready = _has_provider_config("secondary")

    if primary_ready and secondary_ready:
        return analyze_with_two_ai(
            text=text,
            history_last10=history_last10,
            typing=typing,
            model_a=model_a,
            model_b=model_b,
            on_retry=on_retry,
            provider_a="primary",
            provider_b="secondary",
        )

    if primary_ready:
        return analyze_message(
            text=text,
            history_last10=history_last10,
            typing=typing,
            model=model_a,
            on_retry=on_retry,
            provider="primary",
        )

    if secondary_ready:
        return analyze_message(
            text=text,
            history_last10=history_last10,
            typing=typing,
            model=model_b,
            on_retry=on_retry,
            provider="secondary",
        )

    raise AnalyzeError("未設定任何可用的 AI API，無法進行情緒分析。")