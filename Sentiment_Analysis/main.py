from __future__ import annotations

import os
import sys
import time
import json
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

import readchar
import torch
from dotenv import load_dotenv

# Path search
from src.analyzer import AnalyzeError, analyze_message
from src.display import (
    init_console,
    render_analysis,
    render_block_summary,
    render_error,
    render_info,
    render_startup_banner,
)
from src.history import ConversationHistory


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
    raise SystemExit(main())

