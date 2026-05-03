from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


EkmanKey = str


@dataclass
class MessageRecord:
    idx: int
    text: str
    typing: Dict[str, Any]
    analysis: Optional[Dict[str, Any]] = None


@dataclass
class ConversationHistory:
    records: List[MessageRecord] = field(default_factory=list)

    def add(self, *, text: str, typing: Dict[str, Any], analysis: Optional[Dict[str, Any]]) -> MessageRecord:
        rec = MessageRecord(idx=len(self.records) + 1, text=text, typing=typing, analysis=analysis)
        self.records.append(rec)
        return rec

    def last_n_for_model(self, n: int = 10) -> List[Dict[str, Any]]:
        """
        給模型的最近 n 筆上下文（不含本次輸入）。
        只提供必要欄位，避免 prompt 過長。
        """
        out: List[Dict[str, Any]] = []
        for r in self.records[-n:]:
            out.append(
                {
                    "idx": r.idx,
                    "text": r.text,
                    "dominant_emotion": (r.analysis or {}).get("dominant_emotion"),
                    "vad": (r.analysis or {}).get("vad"),
                }
            )
        return out

    def should_summarize_block(self, block_size: int = 10) -> bool:
        return len(self.records) > 0 and (len(self.records) % block_size == 0)

    def summarize_last_block(self, block_size: int = 10) -> Dict[str, Any]:
        block = self.records[-block_size:]
        return summarize_records(block)

    def summarize_all(self) -> Dict[str, Any]:
        return summarize_records(self.records)


def summarize_records(records: List[MessageRecord]) -> Dict[str, Any]:
    if not records:
        return {
            "count": 0,
            "dominant_emotion": None,
            "dominant_emotion_count": 0,
            "avg_valence": 0,
            "avg_arousal": 0,
            "avg_dominance": 0,
            "max_arousal": {"idx": None, "value": 0, "dominant_emotion": None},
            "avg_hesitation": 0.0,
            "trend": "stable",
        }

    emo_counts: Dict[str, int] = {}
    valence_sum = arousal_sum = dominance_sum = 0
    vad_n = 0
    hes_sum = 0.0
    hes_n = 0

    max_ar = -1
    max_ar_rec: Optional[MessageRecord] = None

    valences: List[int] = []

    for r in records:
        if r.analysis:
            dom = r.analysis.get("dominant_emotion")
            if isinstance(dom, str) and dom:
                emo_counts[dom] = emo_counts.get(dom, 0) + 1

            vad = r.analysis.get("vad") or {}
            if isinstance(vad, dict):
                v = vad.get("valence")
                a = vad.get("arousal")
                d = vad.get("dominance")
                if isinstance(v, int) and isinstance(a, int) and isinstance(d, int):
                    valence_sum += v
                    arousal_sum += a
                    dominance_sum += d
                    vad_n += 1
                    valences.append(v)
                    if a > max_ar:
                        max_ar = a
                        max_ar_rec = r

        h = r.typing.get("hesitation_index")
        if isinstance(h, (int, float)):
            hes_sum += float(h)
            hes_n += 1

    dominant_emotion = None
    dominant_emotion_count = 0
    for k, c in emo_counts.items():
        if c > dominant_emotion_count:
            dominant_emotion = k
            dominant_emotion_count = c

    avg_valence = round(valence_sum / vad_n) if vad_n else 0
    avg_arousal = round(arousal_sum / vad_n) if vad_n else 0
    avg_dominance = round(dominance_sum / vad_n) if vad_n else 0

    # 粗略趨勢：用區塊首尾 valence 判斷
    trend = "stable"
    if len(valences) >= 2:
        diff = valences[-1] - valences[0]
        if diff >= 20:
            trend = "up"
        elif diff <= -20:
            trend = "down"
        else:
            trend = "stable"

    max_arousal_info = {"idx": None, "value": 0, "dominant_emotion": None}
    if max_ar_rec and max_ar >= 0:
        max_arousal_info = {
            "idx": max_ar_rec.idx,
            "value": max_ar,
            "dominant_emotion": (max_ar_rec.analysis or {}).get("dominant_emotion"),
        }

    return {
        "count": len(records),
        "dominant_emotion": dominant_emotion,
        "dominant_emotion_count": dominant_emotion_count,
        "avg_valence": avg_valence,
        "avg_arousal": avg_arousal,
        "avg_dominance": avg_dominance,
        "max_arousal": max_arousal_info,
        "avg_hesitation": round(hes_sum / hes_n, 1) if hes_n else 0.0,
        "trend": trend,
    }
