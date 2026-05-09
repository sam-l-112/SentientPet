from __future__ import annotations

import os
import sys
import time
import json
import readchar
import torch
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple
from dotenv import load_dotenv
from flask import Flask, request, jsonify   

# Path search
from src.analyzer import AnalyzeError, analyze_message

# Load environment variables from root .env and src/.env when available
load_dotenv()
root_dir = os.path.dirname(__file__)
src_dotenv = os.path.join(root_dir, "src", ".env")
if os.path.exists(src_dotenv):
    load_dotenv(src_dotenv, override=False)
from src.display import (
    init_console,
    render_analysis,
    render_block_summary,
    render_error,
    render_info,
    render_startup_banner,
)
from src.history import ConversationHistory

load_dotenv()
app = Flask(__name__)

# api 結構
@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"success": False, "error": "請提供 JSON body"}), 400

    text = (data.get('text') or '').strip()
    if not text:
        return jsonify({"success": False, "error": "text 欄位為必填"}), 400

    history_last10 = data.get('history_last10') or []
    typing = data.get('typing')
    if not isinstance(typing, dict):
        typing = {
            "timestamps": [],
            "duration_sec": 0.0,
            "total_chars": len(text),
            "wpm": 0,
            "backspaces": 0,
            "pauses": 0,
            "hesitation_index": 0.0,
        }

    try:
        if data.get('model'):
            model = data.get('model')
        elif os.getenv('HF_TOKEN'):
            model = os.getenv('HF_MODEL_NAME_GEMINI', 'google/gemma-4-31B-it:novita')
        elif os.getenv('OPENROUTER_API_KEY'):
            model = 'openai/gpt-oss-120b:free'
        else:
            model = 'google/gemma-4-31B-it:novita'

        analysis = analyze_message(
            text=text,
            history_last10=history_last10,
            typing=typing,
            model=model,
        )
        return jsonify({"success": True, "data": analysis})
    except AnalyzeError as e:
        return jsonify({"success": False, "error": str(e)}), 500
    except Exception as e:
        return jsonify({"success": False, "error": f"伺服器錯誤：{e}"}), 500


PAUSE_THRESHOLD_SEC = 2.0


@dataclass
class TypingCapture:
    text: str
    timestamps: List[float]  # epoch seconds for each keystroke
    backspaces: int
    pauses: int
    duration_sec: float
    wpm: int
    hesitation_index: float


def capture_input_readchar(prompt: str = "你：") -> TypingCapture:
    sys.stdout.write(prompt + " ")
    sys.stdout.flush()

    buf: List[str] = []
    key_times: List[float] = []
    backspaces = 0
    pauses = 0
    started_at: float | None = None
    last_t: float | None = None

    while True:
        ch = readchar.readkey()
        now = time.time()
        if started_at is None:
            started_at = now
        if last_t is not None and (now - last_t) > PAUSE_THRESHOLD_SEC:
            pauses += 1
        last_t = now
        key_times.append(now)

        # Enter
        if ch in ("\r", "\n"):
            sys.stdout.write("\n")
            sys.stdout.flush()
            break

        # Ctrl+C / Ctrl+D -> 結束
        if ch in ("\x03", "\x04"):
            sys.stdout.write("\n")
            sys.stdout.flush()
            raise KeyboardInterrupt

        # Backspace
        if ch in ("\x08", "\x7f"):
            backspaces += 1
            if buf:
                buf.pop()
                # 退格回顯（覆蓋一個字元）
                sys.stdout.write("\b \b")
                sys.stdout.flush()
            continue

        # 可見字元
        if isinstance(ch, str) and ch:
            buf.append(ch)
            sys.stdout.write(ch)
            sys.stdout.flush()

    text = "".join(buf)
    if started_at is None:
        started_at = time.time()
    duration = max(0.001, time.time() - started_at)
    total_chars = max(1, len(text))

    # WPM：以 5 chars 為一個 word（常見定義）
    wpm = int(round((len(text) / 5) / (duration / 60)))

    hesitation_index = round(((backspaces * 2 + pauses) / total_chars) * 100, 1)

    return TypingCapture(
        text=text,
        timestamps=key_times,
        backspaces=backspaces,
        pauses=pauses,
        duration_sec=round(duration, 3),
        wpm=wpm,
        hesitation_index=hesitation_index,
    )


def typing_to_dict(t: TypingCapture) -> Dict[str, Any]:
    return {
        "timestamps": t.timestamps,
        "duration_sec": t.duration_sec,
        "total_chars": len(t.text),
        "wpm": t.wpm,
        "backspaces": t.backspaces,
        "pauses": t.pauses,
        "hesitation_index": t.hesitation_index,
    }


def main() -> int:
    load_dotenv()
    init_console()

    cuda_ok = bool(torch.cuda.is_available())
    print(render_startup_banner(cuda_available=cuda_ok))
    print("輸入文字後按 Enter 送出分析；輸入 quit 或 exit 結束。")

    history = ConversationHistory()

    while True:
        try:
            cap = capture_input_readchar()
        except KeyboardInterrupt:
            print(render_info("已中止輸入，準備結束並輸出最終總結。"))
            break

        text = cap.text.strip()
        if not text:
            print(render_info("空白輸入已略過。"))
            continue

        if text.lower() in ("quit", "exit"):
            break

        typing_data = typing_to_dict(cap)

        analysis: Dict[str, Any] | None = None
        try:
            analysis = analyze_message(
                text=text,
                history_last10=history.last_n_for_model(10),
                typing=typing_data,
                model="openai/gpt-oss-120b:free",
                on_retry=lambda m: print(render_info(m)),
            )
        except AnalyzeError as e:
            print(render_error(str(e)))

        rec = history.add(text=text, typing=typing_data, analysis=analysis)

        if analysis:
            print(render_analysis(idx=rec.idx, analysis=analysis, typing=typing_data))

        if history.should_summarize_block(10):
            block_summary = history.summarize_last_block(10)
            print(render_block_summary(block_summary=block_summary, block_size=10))

    final = history.summarize_all()
    if final.get("count", 0) > 0:
        print(render_block_summary(block_summary=final, block_size=int(final.get("count") or 0)))
    else:
        print(render_info("本次沒有可總結的訊息。"))

    return 0


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1].lower() == 'cli':
        raise SystemExit(main())
    
# api server python Start
    print("python server 啟動 API (port 5000)")
    app.run(host='127.0.0.1', port=5000, debug=True)

