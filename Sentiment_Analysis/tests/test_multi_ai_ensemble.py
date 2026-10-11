import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from analyzer import (
    AnalyzeError,
    AnalyzeTimeoutError,
    _has_provider_config,
    _go_emotions_to_analysis,
    _parse_go_emotions_response,
    analyze_with_configured_models,
    analyze_with_hf_emotion_classifier,
    analyze_with_available_ai,
    analyze_with_multiple_ai,
    average_results,
)


def test_average_results_supports_multiple_models():
    result_a = {
        "ekman": {"happiness": 20, "sadness": 10, "anger": 5, "fear": 0, "disgust": 0, "surprise": 0},
        "vad": {"arousal": 40, "dominance": 40},
        "context_shift": "stable",
        "summary": "模型 A",
    }
    result_b = {
        "ekman": {"happiness": 40, "sadness": 20, "anger": 10, "fear": 0, "disgust": 0, "surprise": 0},
        "vad": {"arousal": 60, "dominance": 50},
        "context_shift": "stable",
        "summary": "模型 B",
    }
    result_c = {
        "ekman": {"happiness": 60, "sadness": 30, "anger": 15, "fear": 0, "disgust": 0, "surprise": 0},
        "vad": {"arousal": 80, "dominance": 70},
        "context_shift": "up",
        "summary": "模型 C",
    }

    aggregated = average_results([result_a, result_b, result_c])

    assert aggregated["ekman"]["happiness"] == 40.0
    assert aggregated["ekman"]["sadness"] == 20.0
    assert aggregated["dominant_emotion"] == "happiness"
    assert aggregated["vad"]["arousal"] == 60
    assert aggregated["vad"]["dominance"] == 53
    assert aggregated["context_shift"] == "stable"
    assert "模型 A" in aggregated["summary"] and "模型 B" in aggregated["summary"] and "模型 C" in aggregated["summary"]


def test_analyze_with_multiple_ai_uses_all_available_models(monkeypatch):
    calls = []

    def fake_analyze_message(**kwargs):
        calls.append(kwargs["model"])
        return {
            "ekman": {"happiness": 10, "sadness": 0, "anger": 0, "fear": 0, "disgust": 0, "surprise": 0},
            "vad": {"arousal": 50, "dominance": 50},
            "context_shift": "stable",
            "summary": kwargs["model"],
        }

    monkeypatch.setattr("analyzer.analyze_message", fake_analyze_message)
    monkeypatch.setattr("analyzer._has_provider_config", lambda provider: True)

    result = analyze_with_multiple_ai(
        text="hello",
        history_last10=[],
        typing={},
        models=["model-a", "model-b", "model-c"],
        providers=["primary", "secondary", "primary"],
    )

    assert len(calls) == 3
    assert result["dominant_emotion"] == "happiness"
    assert result["ekman"]["happiness"] == 10.0


def test_available_ai_uses_root_model_and_ignores_legacy_classifier_config(monkeypatch):
    monkeypatch.setenv("HF_TOKEN", "primary-token")
    monkeypatch.setenv("HF_MODEL_NAME_GEMINI", "root-configured-chat-model")
    monkeypatch.delenv("SECONDARY_HF_TOKEN", raising=False)
    monkeypatch.delenv("SECONDARY_OPENROUTER_API_KEY", raising=False)
    monkeypatch.setenv("HF_TOKEN_2", "legacy-token")
    monkeypatch.setenv(
        "HF_MODEL_URL_2",
        "https://router.huggingface.co/hf-inference/models/SamLowe/roberta-base-go_emotions",
    )

    calls = []

    def fake_analyze_message(**kwargs):
        calls.append(kwargs)
        return {"summary": "ok"}

    monkeypatch.setattr("analyzer.analyze_message", fake_analyze_message)

    result = analyze_with_available_ai(
        text="hello",
        history_last10=[],
        typing={},
        model_a="request-supplied-model",
        model_b="legacy-model",
    )

    assert result == {"summary": "ok"}
    assert len(calls) == 1
    assert calls[0]["provider"] == "primary"
    assert calls[0]["model"] == "root-configured-chat-model"


def test_secondary_requires_explicit_chat_credentials(monkeypatch):
    monkeypatch.delenv("SECONDARY_HF_TOKEN", raising=False)
    monkeypatch.delenv("SECONDARY_OPENROUTER_API_KEY", raising=False)
    monkeypatch.setenv("HF_TOKEN_2", "legacy-token")
    monkeypatch.setenv("LLM_API_2", "legacy-token")

    assert not _has_provider_config("secondary")

    monkeypatch.setenv("SECONDARY_HF_TOKEN", "secondary-chat-token")
    assert _has_provider_config("secondary")


def test_go_emotions_response_maps_to_existing_sentiment_schema():
    scores = _parse_go_emotions_response([[
        {"label": "joy", "score": 0.7},
        {"label": "amusement", "score": 0.2},
        {"label": "sadness", "score": 0.25},
        {"label": "neutral", "score": 0.05},
    ]])

    result = _go_emotions_to_analysis(scores)

    assert result["ekman"]["happiness"] == 90.0
    assert result["ekman"]["sadness"] == 25.0
    assert result["dominant_emotion"] == "happiness"
    assert result["vad"]["valence"] > 50
    assert result["context_shift"] == "mixed"
    assert result["summary"]


def test_hf_classifier_uses_roberta_endpoint_and_hf_token(monkeypatch):
    monkeypatch.setenv("HF_TOKEN_2", "hf-test-token")
    monkeypatch.setenv(
        "HF_MODEL_URL_2",
        "https://router.huggingface.co/hf-inference/models/SamLowe/roberta-base-go_emotions",
    )
    monkeypatch.setenv("HF_MODEL_NAME_SamLowe", "SamLowe/roberta-base-go_emotions")

    class MockResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return [{"label": "joy", "score": 0.8}, {"label": "neutral", "score": 0.1}]

    calls = []

    def mock_post(url, **kwargs):
        calls.append((url, kwargs))
        return MockResponse()

    monkeypatch.setattr("analyzer.requests.post", mock_post)

    result = analyze_with_hf_emotion_classifier("我今天很開心")

    assert calls[0][0].endswith("/SamLowe/roberta-base-go_emotions")
    assert calls[0][1]["headers"]["Authorization"] == "Bearer hf-test-token"
    assert calls[0][1]["json"]["inputs"] == "我今天很開心"
    assert result["dominant_emotion"] == "happiness"


def test_hf_classifier_requires_hf_token(monkeypatch):
    monkeypatch.delenv("HF_TOKEN_2", raising=False)

    try:
        analyze_with_hf_emotion_classifier("我今天很開心")
    except Exception as error:
        assert "HF_TOKEN_2" in str(error)
    else:
        raise AssertionError("Expected a missing-token error")


def test_configured_models_compare_hf_classifier_and_chat_model(monkeypatch):
    monkeypatch.setenv("HF_TOKEN_2", "hf-primary-token")
    monkeypatch.setenv(
        "HF_MODEL_URL_2",
        "https://router.huggingface.co/hf-inference/models/SamLowe/roberta-base-go_emotions",
    )
    monkeypatch.setenv("HF_MODEL_NAME_SamLowe", "SamLowe/roberta-base-go_emotions")
    monkeypatch.setenv("HF_TOKEN", "nvidia-chat-token")
    monkeypatch.setenv("HF_MODEL_URL", "https://integrate.api.nvidia.com/v1")
    monkeypatch.setenv("HF_MODEL_NAME_GEMINI", "meta/muse-glimmer-30b")

    classifier_result = {
        "ekman": {"happiness": 80, "sadness": 0, "anger": 0, "fear": 0, "disgust": 0, "surprise": 0},
        "vad": {"valence": 100, "arousal": 70, "dominance": 65},
        "context_shift": "up",
        "summary": "GoEmotions",
    }
    chat_result = {
        "ekman": {"happiness": 40, "sadness": 20, "anger": 0, "fear": 0, "disgust": 0, "surprise": 0},
        "vad": {"arousal": 50, "dominance": 50},
        "context_shift": "stable",
        "summary": "Muse",
    }
    classifier_calls = []
    chat_calls = []

    def fake_classifier(text):
        classifier_calls.append(text)
        return classifier_result

    def fake_chat(**kwargs):
        chat_calls.append(kwargs)
        return chat_result

    monkeypatch.setattr("analyzer.analyze_with_hf_emotion_classifier", fake_classifier)
    monkeypatch.setattr("analyzer.analyze_message", fake_chat)

    result = analyze_with_configured_models(
        text="分析這段文字",
    )

    assert classifier_calls == ["分析這段文字"]
    assert len(chat_calls) == 1
    assert chat_calls[0]["model"] == "meta/muse-glimmer-30b"
    assert chat_calls[0]["provider"] == "primary"
    assert chat_calls[0]["text"] == "分析這段文字"
    assert chat_calls[0]["history_last10"] == []
    assert chat_calls[0]["typing"] == {}
    assert result["ekman"]["happiness"] == 60.0
    assert result["vad"]["valence"] == 83.3
    assert result["summary"] == "GoEmotions | Muse"
    assert "model_status" not in result


def test_configured_models_log_classifier_failure_and_return_chat_result_only(monkeypatch, caplog):
    monkeypatch.setenv("HF_TOKEN_2", "hf-primary-token")
    monkeypatch.setenv("HF_MODEL_URL_2", "https://router.huggingface.co/hf-inference/models/model")
    monkeypatch.setenv("HF_TOKEN", "nvidia-chat-token")
    monkeypatch.setenv("HF_MODEL_URL", "https://integrate.api.nvidia.com/v1")
    monkeypatch.setenv("HF_MODEL_NAME_GEMINI", "meta/muse-glimmer-30b")

    monkeypatch.setattr(
        "analyzer.analyze_with_hf_emotion_classifier",
        lambda text: (_ for _ in ()).throw(AnalyzeError("classifier unavailable")),
    )
    monkeypatch.setattr(
        "analyzer.analyze_message",
        lambda **kwargs: {
            "ekman": {"happiness": 50, "sadness": 0, "anger": 0, "fear": 0, "disgust": 0, "surprise": 0},
            "vad": {"arousal": 50, "dominance": 50},
            "context_shift": "stable",
            "summary": "Muse",
        },
    )

    result = analyze_with_configured_models(text="test")

    assert result["ekman"]["happiness"] == 50
    assert result["summary"] == "Muse"
    assert "model_status" not in result
    assert "classifier unavailable" in caplog.text
    assert "GoEmotions 主模型" in caplog.text


def test_configured_models_log_chat_failure_and_return_classifier_result_only(monkeypatch, caplog):
    monkeypatch.setenv("HF_TOKEN_2", "hf-primary-token")
    monkeypatch.setenv("HF_MODEL_URL_2", "https://router.huggingface.co/hf-inference/models/model")
    monkeypatch.setenv("HF_TOKEN", "nvidia-chat-token")
    monkeypatch.setenv("HF_MODEL_URL", "https://integrate.api.nvidia.com/v1")
    monkeypatch.setenv("HF_MODEL_NAME_GEMINI", "meta/muse-glimmer-30b")
    classifier_result = {
        "ekman": {"happiness": 80, "sadness": 0, "anger": 0, "fear": 0, "disgust": 0, "surprise": 0},
        "vad": {"valence": 100, "arousal": 70, "dominance": 65},
        "context_shift": "up",
        "summary": "GoEmotions",
    }
    monkeypatch.setattr("analyzer.analyze_with_hf_emotion_classifier", lambda text: classifier_result)
    monkeypatch.setattr(
        "analyzer.analyze_message",
        lambda **kwargs: (_ for _ in ()).throw(AnalyzeError("Muse unavailable")),
    )

    result = analyze_with_configured_models(text="test")

    assert result["ekman"]["happiness"] == 80
    assert result["summary"] == "GoEmotions"
    assert "model_status" not in result
    assert "Muse unavailable" in caplog.text
    assert "Muse 輔助模型" in caplog.text


def test_configured_models_log_timeout_and_keep_it_out_of_fallback_result(monkeypatch, caplog):
    monkeypatch.setenv("HF_TOKEN_2", "hf-primary-token")
    monkeypatch.setenv("HF_MODEL_URL_2", "https://router.huggingface.co/hf-inference/models/model")
    monkeypatch.setenv("HF_TOKEN", "nvidia-chat-token")
    monkeypatch.setenv("HF_MODEL_URL", "https://integrate.api.nvidia.com/v1")
    monkeypatch.setenv("HF_MODEL_NAME_GEMINI", "meta/muse-glimmer-30b")

    monkeypatch.setattr(
        "analyzer.analyze_with_hf_emotion_classifier",
        lambda text: (_ for _ in ()).throw(AnalyzeTimeoutError("classifier timed out")),
    )
    monkeypatch.setattr(
        "analyzer.analyze_message",
        lambda **kwargs: {
            "ekman": {"happiness": 50, "sadness": 0, "anger": 0, "fear": 0, "disgust": 0, "surprise": 0},
            "vad": {"arousal": 50, "dominance": 50},
            "context_shift": "stable",
            "summary": "Muse",
        },
    )

    result = analyze_with_configured_models(text="test")

    assert result["summary"] == "Muse"
    assert "model_status" not in result
    assert "classifier timed out" in caplog.text


def test_configured_models_do_not_return_model_errors_when_both_fail(monkeypatch, caplog):
    monkeypatch.setenv("HF_TOKEN_2", "hf-primary-token")
    monkeypatch.setenv("HF_MODEL_URL_2", "https://router.huggingface.co/hf-inference/models/model")
    monkeypatch.setenv("HF_TOKEN", "nvidia-chat-token")
    monkeypatch.setenv("HF_MODEL_URL", "https://integrate.api.nvidia.com/v1")
    monkeypatch.setenv("HF_MODEL_NAME_GEMINI", "meta/muse-glimmer-30b")
    monkeypatch.setattr(
        "analyzer.analyze_with_hf_emotion_classifier",
        lambda text: (_ for _ in ()).throw(AnalyzeError("classifier private detail")),
    )
    monkeypatch.setattr(
        "analyzer.analyze_message",
        lambda **kwargs: (_ for _ in ()).throw(AnalyzeError("Muse private detail")),
    )

    try:
        analyze_with_configured_models(text="test")
    except AnalyzeError as error:
        assert "private detail" not in str(error)
        assert str(error) == "情緒分析暫時無法完成，請稍後再試。"
    else:
        raise AssertionError("Expected an error when both models fail")

    assert "classifier private detail" in caplog.text
    assert "Muse private detail" in caplog.text


def test_normalize_emotion_result_rejects_missing_scores():
    try:
        from analyzer import normalize_emotion_result
        normalize_emotion_result({"ekman": {"happiness": 10}, "vad": {}})
    except AnalyzeError as error:
        assert "sadness" in str(error)
    else:
        raise AssertionError("Expected incomplete model scores to be rejected")
