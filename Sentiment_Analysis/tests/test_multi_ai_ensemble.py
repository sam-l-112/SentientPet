import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from analyzer import analyze_with_multiple_ai, average_results


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
