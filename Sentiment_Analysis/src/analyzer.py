from __future__ import annotations

import json
import logging
import math
import os
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Dict, List, Optional

import openai
import requests

logger = logging.getLogger(__name__)


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
        hf_token = _get_first_env("SECONDARY_HF_TOKEN")
        openrouter_key = _get_first_env("SECONDARY_OPENROUTER_API_KEY")
        hf_model_url = _get_first_env(
            "SECONDARY_HF_MODEL_URL",
            "HF_MODEL_URL",
            default="https://router.huggingface.co/v1",
        )
    else:
        hf_token = _get_first_env("HF_TOKEN", "LLM_API_KEY")
        openrouter_key = _get_first_env("OPENROUTER_API_KEY")
        hf_model_url = _get_first_env(
            "HF_MODEL_URL",
            "LLM_BASE_URL",
            default="https://router.huggingface.co/v1",
        )

    if hf_token:
        if hf_model_url.endswith("/chat/completions"):
            hf_model_url = hf_model_url[: -len("/chat/completions")]
        hf_model_url = hf_model_url.rstrip("/")
        return openai.OpenAI(
            base_url=hf_model_url,
            api_key=hf_token,
            timeout=90.0,
            max_retries=0,
        )

    if openrouter_key:
        base_url = os.getenv("SECONDARY_OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1") if provider_name == "secondary" else "https://openrouter.ai/api/v1"
        return openai.OpenAI(
            base_url=base_url,
            api_key=openrouter_key,
            timeout=30,
            max_retries=0,
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


GO_EMOTIONS_TO_EKMAN = {
    "happiness": ("admiration", "amusement", "approval", "caring", "excitement", "gratitude", "joy", "love", "optimism", "pride", "relief"),
    "sadness": ("disappointment", "grief", "remorse", "sadness"),
    "anger": ("anger", "annoyance", "disapproval"),
    "fear": ("fear", "nervousness"),
    "disgust": ("disgust",),
    "surprise": ("surprise", "realization"),
}

EMOTION_NAMES_ZH = {
    "happiness": "快樂",
    "sadness": "悲傷",
    "anger": "憤怒",
    "fear": "恐懼",
    "disgust": "厭惡",
    "surprise": "驚訝",
    "neutral": "中性",
}


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


def _parse_go_emotions_response(response_data: Any) -> Dict[str, float]:
    """Parse Hugging Face text-classification scores without assuming one response shape."""
    while isinstance(response_data, list) and len(response_data) == 1 and isinstance(response_data[0], list):
        response_data = response_data[0]

    if not isinstance(response_data, list):
        raise AnalyzeError("Hugging Face 情緒分類回傳格式不正確。")

    scores: Dict[str, float] = {}
    for item in response_data:
        if not isinstance(item, dict) or not isinstance(item.get("label"), str):
            continue
        try:
            score = float(item["score"])
        except (KeyError, TypeError, ValueError):
            continue
        if math.isfinite(score):
            label = item["label"].lower()
            scores[label] = max(scores.get(label, 0.0), min(1.0, max(0.0, score)))

    if not scores:
        raise AnalyzeError("Hugging Face 情緒分類沒有回傳有效標籤分數。")
    return scores


def _go_emotions_to_analysis(scores: Dict[str, float]) -> Dict[str, Any]:
    ekman = {
        emotion: round(min(1.0, sum(scores.get(label, 0.0) for label in labels)) * 100, 1)
        for emotion, labels in GO_EMOTIONS_TO_EKMAN.items()
    }
    dominant_emotion = max(ekman, key=ekman.get)
    dominant_score = ekman[dominant_emotion] / 100
    neutral_score = scores.get("neutral", 0.0)
    if neutral_score >= dominant_score:
        dominant_emotion = "neutral"
        dominant_score = neutral_score

    positive = ekman["happiness"] / 100
    negative = sum(ekman[key] for key in ("sadness", "anger", "fear", "disgust")) / 100
    polarity_total = positive + negative
    valence = 50.0 if polarity_total == 0 else 50 + 50 * (positive - negative) / polarity_total
    valence = round(min(100.0, max(0.0, valence)), 1)

    emotion_weights = {
        "happiness": (0.65, 0.7),
        "sadness": (0.25, 0.3),
        "anger": (0.7, 0.8),
        "fear": (0.2, 0.8),
        "disgust": (0.4, 0.6),
        "surprise": (0.5, 0.8),
    }
    weights_total = sum(ekman.values())
    if weights_total:
        arousal = sum(ekman[key] * values[1] for key, values in emotion_weights.items()) / weights_total * 100
        dominance = sum(ekman[key] * values[0] for key, values in emotion_weights.items()) / weights_total * 100
    else:
        arousal = dominance = 50.0

    positive_present = positive >= 0.2
    negative_present = negative >= 0.2
    if positive_present and negative_present:
        context_shift = "mixed"
    elif valence >= 60:
        context_shift = "up"
    elif valence <= 40:
        context_shift = "down"
    else:
        context_shift = "stable"

    summary = (
        f"主要情緒為{EMOTION_NAMES_ZH[dominant_emotion]}"
        f"（模型分數 {dominant_score * 100:.1f}%）。"
    )
    return {
        "ekman": ekman,
        "dominant_emotion": dominant_emotion,
        "vad": {
            "valence": valence,
            "arousal": round(min(100.0, max(0.0, arousal))),
            "dominance": round(min(100.0, max(0.0, dominance))),
        },
        "context_shift": context_shift,
        "summary": summary,
    }


def analyze_with_hf_emotion_classifier(text: str) -> Dict[str, Any]:
    """Run GoEmotions through the Hugging Face text-classification endpoint."""
    token = _get_first_env("HF_TOKEN_2")
    model = _get_first_env("HF_MODEL_NAME_SamLowe", default="SamLowe/roberta-base-go_emotions")
    endpoint = _get_first_env(
        "HF_MODEL_URL_2",
        default=f"https://router.huggingface.co/hf-inference/models/{model}",
    )
    if not token:
        raise AnalyzeError("未設定 Hugging Face 情緒分類 token（HF_TOKEN_2）。")
    if not endpoint:
        raise AnalyzeError("未設定 Hugging Face 情緒分類 API URL（HF_MODEL_URL_2）。")
    if endpoint.rstrip("/").endswith("/chat/completions"):
        raise AnalyzeError("GoEmotions 是分類模型，請使用 Hugging Face text-classification endpoint。")

    try:
        response = requests.post(
            endpoint,
            headers={"Authorization": f"Bearer {token}"},
            json={
                "inputs": text,
                "parameters": {"function_to_apply": "sigmoid", "top_k": None},
                "options": {"wait_for_model": True},
            },
            timeout=45.0,
        )
        response.raise_for_status()
    except requests.Timeout as error:
        raise AnalyzeTimeoutError("Hugging Face 情緒分類請求逾時。") from error
    except requests.RequestException as error:
        status = error.response.status_code if error.response is not None else "connection"
        raise AnalyzeError(f"Hugging Face 情緒分類請求失敗（{status}）。") from error

    try:
        response_data = response.json()
    except ValueError as error:
        raise AnalyzeError("Hugging Face 情緒分類回傳了無效 JSON。") from error
    if isinstance(response_data, dict) and response_data.get("error"):
        raise AnalyzeError(f"Hugging Face 情緒分類錯誤：{response_data['error']}")

    return _go_emotions_to_analysis(_parse_go_emotions_response(response_data))


def _has_provider_config(provider: str = "primary") -> bool:
    provider_name = (provider or "primary").lower()
    if provider_name == "secondary":
        return bool(
            _get_first_env("SECONDARY_HF_TOKEN")
            or _get_first_env("SECONDARY_OPENROUTER_API_KEY")
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

    if provider == "secondary":
        model = _get_first_env("SECONDARY_HF_MODEL_NAME", default=model) or model
    else:
        model = _get_first_env(
            "HF_MODEL_NAME_GEMINI",
            "HF_MODEL_NAME_2",
            "HF_MODEL_NAME_SamLowe",
            "LLM_MODEL",
            default=model,
        ) or model

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
                timeout=45.0,
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


def analyze_with_configured_models(
    *,
    text: str,
) -> Dict[str, Any]:
    """Compare the configured GoEmotions classifier with the configured chat model."""
    chat_model = _get_first_env("HF_MODEL_NAME_GEMINI")
    if not chat_model:
        raise AnalyzeError("未設定輔助情緒分析模型（HF_MODEL_NAME_GEMINI）。")
    if not _get_first_env("HF_TOKEN"):
        raise AnalyzeError("未設定輔助情緒分析服務 token（HF_TOKEN）。")
    if not _get_first_env("HF_MODEL_URL"):
        raise AnalyzeError("未設定輔助情緒分析 API URL（HF_MODEL_URL）。")
    if not _get_first_env("HF_TOKEN_2"):
        raise AnalyzeError("未設定主要 GoEmotions 模型 token（HF_TOKEN_2）。")
    if not _get_first_env("HF_MODEL_URL_2"):
        raise AnalyzeError("未設定主要 GoEmotions 模型 API URL（HF_MODEL_URL_2）。")

    with ThreadPoolExecutor(max_workers=2) as executor:
        classifier_future = executor.submit(analyze_with_hf_emotion_classifier, text)
        chat_future = executor.submit(
            analyze_message,
            text=text,
            history_last10=[],
            typing={},
            model=chat_model,
            provider="primary",
        )

        results: List[tuple[str, Dict[str, Any]]] = []
        errors: List[tuple[str, AnalyzeError]] = []
        for label, future in (
            ("GoEmotions 主模型", classifier_future),
            ("Muse 輔助模型", chat_future),
        ):
            try:
                results.append((label, future.result()))
            except AnalyzeError as error:
                errors.append((label, error))

    if not results:
        details = "；".join(f"{label}: {error}" for label, error in errors)
        logger.error("情緒分析模型皆失敗：%s", details)
        if any(isinstance(error, AnalyzeTimeoutError) for _, error in errors):
            raise AnalyzeTimeoutError("情緒分析暫時無法完成，請稍後再試。")
        raise AnalyzeError("情緒分析暫時無法完成，請稍後再試。")

    if errors:
        successful_label, successful_result = results[0]
        failed_details = "；".join(f"{label}失敗：{error}" for label, error in errors)
        logger.warning(
            "情緒分析採用單一模型備援：成功=%s；失敗=%s",
            successful_label,
            failed_details,
        )
        fallback_result = dict(successful_result)
        fallback_result["summary"] = successful_result.get("summary", "")
        return fallback_result

    logger.info("GoEmotions 與 Muse 情緒分析皆成功。")
    combined = average_results([result for _, result in results])
    combined["summary"] = (
        f"{results[0][1].get('summary', '')} | "
        f"{results[1][1].get('summary', '')}"
    )
    return combined


def normalize_emotion_result(result: Dict[str, Any]) -> Dict[str, Any]:
    """確保提取出的 Ekman 與 VAD 數據格式符合規範與預設值"""
    ekman = result.get("ekman", {})
    vad = result.get("vad", {})
    emotion_names = ("happiness", "sadness", "anger", "fear", "disgust", "surprise")
    if not isinstance(ekman, dict) or not isinstance(vad, dict):
        raise AnalyzeError("模型回傳的情緒分析格式不正確。")

    normalized_ekman: Dict[str, float] = {}
    for emotion in emotion_names:
        try:
            score = float(ekman[emotion])
        except (KeyError, TypeError, ValueError) as error:
            raise AnalyzeError(f"模型回傳缺少有效的 {emotion} 分數。") from error
        if not math.isfinite(score) or not 0 <= score <= 100:
            raise AnalyzeError(f"模型回傳的 {emotion} 分數超出 0 到 100 範圍。")
        normalized_ekman[emotion] = score

    positive = float(ekman.get("happiness", 0))
    negative = sum(
        float(ekman.get(emotion, 0))
        for emotion in ("sadness", "anger", "fear", "disgust")
    )
    polarity_total = positive + negative
    derived_valence = 50.0 if polarity_total == 0 else 50 + 50 * (positive - negative) / polarity_total

    return {
        "ekman": normalized_ekman,
        "vad": {
            "valence": float(vad.get("valence", derived_valence)),
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
        "valence": round(sum(item["vad"]["valence"] for item in normalized_results) / len(normalized_results), 1),
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
    """使用主 .env 的模型；僅在明確設定 SECONDARY_* 時才併用備援模型。"""
    model_a = _get_first_env(
        "HF_MODEL_NAME_GEMINI",
        "HF_MODEL_NAME_2",
        "HF_MODEL_NAME_SamLowe",
        "LLM_MODEL",
        default=model_a,
    ) or model_a
    model_b = _get_first_env("SECONDARY_HF_MODEL_NAME", default=model_b) or model_b

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