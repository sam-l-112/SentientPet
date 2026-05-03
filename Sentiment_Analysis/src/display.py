from __future__ import annotations

from typing import Any, Dict, Optional

from colorama import Fore, Style, init


def init_console() -> None:
    # Windows 終端機色彩初始化
    init(autoreset=True)


def _bar(score: int, width: int = 10) -> str:
    s = max(0, min(100, int(score)))
    filled = round(s / 100 * width)
    return "█" * filled + "░" * (width - filled)


def _pad(s: str, n: int) -> str:
    return (s + " " * n)[:n]


EMOTION_LABELS = {
    "happiness": "快樂 (Happiness)",
    "sadness": "悲傷 (Sadness)",
    "anger": "憤怒 (Anger)",
    "fear": "恐懼 (Fear)",
    "disgust": "厭惡 (Disgust)",
    "surprise": "驚訝 (Surprise)",
}

EMOTION_ZH = {
    "happiness": "快樂",
    "sadness": "悲傷",
    "anger": "憤怒",
    "fear": "恐懼",
    "disgust": "厭惡",
    "surprise": "驚訝",
}


def _vad_label_valence(v: int) -> str:
    if v >= 30:
        return "（正向）"
    if v <= -30:
        return "（負向）"
    return "（中性）"


def _trend_zh(t: str) -> str:
    return {
        "stable": "stable",
        "up": "up",
        "down": "down",
        "mixed": "mixed",
    }.get(t, "stable")


def render_analysis(
    *,
    idx: int,
    analysis: Dict[str, Any],
    typing: Dict[str, Any],
) -> str:
    ek = (analysis.get("ekman") or {}) if isinstance(analysis.get("ekman"), dict) else {}
    vad = (analysis.get("vad") or {}) if isinstance(analysis.get("vad"), dict) else {}

    dom = analysis.get("dominant_emotion")
    dom_zh = EMOTION_ZH.get(dom, str(dom)) if dom else "未知"

    valence = int(vad.get("valence", 0)) if isinstance(vad.get("valence", 0), int) else 0
    arousal = int(vad.get("arousal", 0)) if isinstance(vad.get("arousal", 0), int) else 0
    dominance = int(vad.get("dominance", 0)) if isinstance(vad.get("dominance", 0), int) else 0

    wpm = typing.get("wpm", 0)
    backspaces = typing.get("backspaces", 0)
    pauses = typing.get("pauses", 0)
    hesitation = typing.get("hesitation_index", 0.0)

    summary = analysis.get("summary") or ""
    shift = _trend_zh(str(analysis.get("context_shift") or "stable"))

    lines = []
    lines.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    lines.append(f"{Fore.CYAN}📊 情緒分析結果 #{idx}{Style.RESET_ALL}")
    lines.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    lines.append("【六大情緒分數】")
    for k in ["happiness", "sadness", "anger", "fear", "disgust", "surprise"]:
        label = _pad(EMOTION_LABELS[k], 16)
        score = int(ek.get(k, 0)) if isinstance(ek.get(k, 0), int) else 0
        lines.append(f"{label}: {_bar(score)}  {score:>3d}")

    lines.append("【VAD 情緒維度】")
    sign = "+" if valence >= 0 else ""
    lines.append(f"效價 Valence  : {sign}{valence:<4d} {_vad_label_valence(valence)}")
    lines.append(f"喚起 Arousal  : {arousal:<3d}  （{_arousal_label(arousal)}）")
    lines.append(f"支配 Dominance: {dominance:<3d}  （{_dominance_label(dominance)}）")

    lines.append("【打字行為】")
    lines.append(f"速度    : {wpm} WPM")
    lines.append(f"刪字    : {backspaces} 次")
    lines.append(f"停頓    : {pauses} 次")
    lines.append(f"猶豫指數: {hesitation}")

    lines.append(f"【主要情緒】{dom_zh}")
    lines.append(f"【情緒趨勢】{shift}")
    lines.append(f"【解讀】{summary}")
    lines.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    return "\n".join(lines)


def _arousal_label(a: int) -> str:
    if a >= 70:
        return "高度激動"
    if a >= 40:
        return "中度激動"
    return "低度激動"


def _dominance_label(d: int) -> str:
    if d >= 70:
        return "掌控感強"
    if d >= 40:
        return "中等掌控"
    return "掌控感弱"


def render_block_summary(*, block_summary: Dict[str, Any], block_size: int = 10) -> str:
    dom = block_summary.get("dominant_emotion")
    dom_zh = EMOTION_ZH.get(dom, str(dom)) if dom else "未知"
    dom_c = int(block_summary.get("dominant_emotion_count") or 0)
    avg_valence = int(block_summary.get("avg_valence") or 0)
    trend = str(block_summary.get("trend") or "stable")
    max_ar = block_summary.get("max_arousal") or {}
    max_idx = max_ar.get("idx")
    max_val = max_ar.get("value", 0)
    max_dom = max_ar.get("dominant_emotion")
    max_dom_zh = EMOTION_ZH.get(max_dom, str(max_dom)) if max_dom else "未知"
    avg_hes = block_summary.get("avg_hesitation", 0.0)

    val_label = _vad_label_valence(avg_valence)
    sign = "+" if avg_valence >= 0 else ""

    # 盡量貼近你給的版面（固定寬度）
    lines = []
    lines.append("╔══════════════════════════════════╗")
    lines.append(f"║       段落情緒總結（{block_size}筆）        ║")
    lines.append("╠══════════════════════════════════╣")
    lines.append(f"║ 主要情緒：{dom_zh} (出現 {dom_c}/{block_size} 次)    ║")
    lines.append(f"║ 平均效價：{sign}{avg_valence} {val_label:<12}      ║")
    lines.append(f"║ 情緒變化：{_trend_desc(trend):<18}      ║")
    if max_idx is not None:
        lines.append(f"║ 最高喚起：第 {max_idx} 筆（{max_dom_zh}，{max_val}）      ║")
    else:
        lines.append("║ 最高喚起：無資料                      ║")
    lines.append(f"║ 猶豫指數：平均 {avg_hes}              ║")
    lines.append("║ 整體解讀：這段對話情緒以主要情緒為主...║")
    lines.append("╚══════════════════════════════════╝")
    return "\n".join(lines)


def _trend_desc(t: str) -> str:
    return {
        "stable": "平穩",
        "up": "逐步上升",
        "down": "逐步下降",
        "mixed": "有輕微起伏",
    }.get(t, "平穩")


def render_startup_banner(*, cuda_available: bool) -> str:
    status = f"{Fore.GREEN}可用{Style.RESET_ALL}" if cuda_available else f"{Fore.YELLOW}不可用{Style.RESET_ALL}"
    return f"CUDA：{status}"


def render_error(msg: str) -> str:
    return f"{Fore.RED}{msg}{Style.RESET_ALL}"


def render_info(msg: str) -> str:
    return f"{Fore.YELLOW}{msg}{Style.RESET_ALL}"

