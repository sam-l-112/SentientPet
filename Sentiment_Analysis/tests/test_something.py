from __future__ import annotations

import json
import sys
import os
# from flask import Flask, request, jsonify
# from src.analyzer import analyze_emotion # 假設你的函數名

# Path search
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src import analyzer

# app = Flask(__name__)

# # === API router ===
# @app.route('/analyze', methods=['POST'])
# def analyze():
#     data = request.json
#     text = data.get('text', '')
    
#     print(f"DEBUG: 收到來自 Node.js 的訊息 -> {text}")

def test_safe_json_loads_parses_sentiment_json():
    raw_output = '''
    {
      "ekman": {
        "happiness": 92,
        "sadness": 3,
        "anger": 1,
        "fear": 2,
        "disgust": 0,
        "surprise": 2
      },
      "dominant_emotion": "happiness",
      "vad": {
        "valence": 75,
        "arousal": 50,
        "dominance": 60
      },
      "context_shift": "up",
      "summary": "這段文字展現出開心、正向的情緒。"
    }
    '''

    data = analyzer._safe_json_loads(raw_output)

    assert data["dominant_emotion"] == "happiness"
    assert set(data["ekman"]) == {"happiness", "sadness", "anger", "fear", "disgust", "surprise"}
    assert 0 <= data["ekman"]["happiness"] <= 100
    assert -100 <= data["vad"]["valence"] <= 100
    assert 0 <= data["vad"]["arousal"] <= 100
    assert 0 <= data["vad"]["dominance"] <= 100
    assert data["context_shift"] in {"stable", "up", "down", "mixed"}
    assert isinstance(data["summary"], str) and data["summary"].strip()


def test_safe_json_loads_can_extract_json_from_noisy_text():
    noisy_output = '分析結果如下：\n{"dominant_emotion": "sadness", "ekman": {"happiness": 10, "sadness": 90, "anger": 0, "fear": 0, "disgust": 0, "surprise": 0}, "vad": {"valence": -70, "arousal": 20, "dominance": 15}, "context_shift": "down", "summary": "這段文字主要表現出悲傷情緒。"} 以上為結束。'

    data = analyzer._safe_json_loads(noisy_output)

    assert data["dominant_emotion"] == "sadness"

# if __name__ == '__main__':
#     app.run(host='127.0.0.1', port=5000, debug=True)