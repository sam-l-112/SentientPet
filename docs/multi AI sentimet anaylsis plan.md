# Multi-AI Sentiment Analysis Plan

## 1. 目標

你現在的目標是：
- 讓 Python 對一段文字做「六大情緒」分析
- 使用兩個 AI 模型各自做一次判斷
- 把兩個結果的數值做平均
- 最後輸出一個整合後的情緒分數與主要情緒

這個方法適合做「多模型投票」或「多模型平均」，可以降低單一模型的偏差。

---

## 2. 你現在的架構可以怎麼理解

你目前的情感分析核心是在：
- Sentiment_Analysis/src/analyzer.py

其中已經有一個主要函式：
- analyze_message(...)

這個函式的角色是：
1. 建立 API client
2. 組合 prompt
3. 呼叫模型
4. 回傳 JSON 格式的分析結果

所以你現在其實已經有「單一 AI 分析」的基礎架構。

---

## 3. 建議的架構設計

最簡單且最穩定的方式，是「保留原本 analyze_message，新增一層多 AI 包裝函式」。

### 3.1 建議的模組分層

#### A. 目前已有的基礎函式
- analyze_message()
  - 用來呼叫單一模型
  - 回傳單次分析結果

#### B. 新增的多 AI 包裝函式
- analyze_with_two_ai()
  - 同時呼叫兩個模型
  - 把結果整理成平均值
  - 最後輸出統整結果

#### C. 可選的輔助函式
- normalize_emotion_result()
  - 確保兩個模型輸出的欄位一致
- average_emotion_scores()
  - 對六大情緒做平均
- choose_dominant_emotion()
  - 根據平均值選出主要情緒

---

## 4. 你要怎麼操作這個架構

### 4.1 同時分析的做法

如果你的需求是「能同時分析」，那就要把兩個模型的呼叫改成並行執行，而不是一個接一個執行。

最核心的概念是：
1. 讓模型 A 和模型 B 同時啟動
2. 兩邊各自回傳分析結果
3. 等兩個結果都完成後，再做平均
4. 最後輸出整合結果

這樣的好處是：
- 總時間比逐一執行更短
- 更符合你想要的「同時分析」需求
- 之後若要擴充成 3 個或 4 個模型，也比較容易

---

## 5. 函式串接方式怎麼表示

你可以把它想成這樣：

```text
輸入文字
  ├─ 模型 A 同時開始分析
  └─ 模型 B 同時開始分析
        ↓
   兩個模型各自回傳結果
        ↓
   把兩個結果做平均
        ↓
   輸出最終情緒結果
```

### 5.1 直觀的函式流程

```python
with ThreadPoolExecutor(max_workers=2) as executor:
    future_a = executor.submit(analyze_message, text=text, history_last10=history_last10, typing=typing, model=model_a)
    future_b = executor.submit(analyze_message, text=text, history_last10=history_last10, typing=typing, model=model_b)

    result_a = future_a.result()
    result_b = future_b.result()

final_result = average_two_results(result_a, result_b)
```

這就是「同時分析」的核心思路。

---

## 6. 建議的 Python 實作範例

### 6.1 基礎版本：兩個模型並行執行

```python
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List


def normalize_emotion_result(result: Dict[str, Any]) -> Dict[str, Any]:
    ekman = result.get("ekman", {})
    return {
        "happiness": float(ekman.get("happiness", 0)),
        "sadness": float(ekman.get("sadness", 0)),
        "anger": float(ekman.get("anger", 0)),
        "fear": float(ekman.get("fear", 0)),
        "disgust": float(ekman.get("disgust", 0)),
        "surprise": float(ekman.get("surprise", 0)),
    }


def average_two_results(result_a: Dict[str, Any], result_b: Dict[str, Any]) -> Dict[str, Any]:
    scores_a = normalize_emotion_result(result_a)
    scores_b = normalize_emotion_result(result_b)

    averaged = {}
    for emotion in ["happiness", "sadness", "anger", "fear", "disgust", "surprise"]:
        averaged[emotion] = round((scores_a[emotion] + scores_b[emotion]) / 2, 2)

    dominant_emotion = max(averaged, key=averaged.get)

    return {
        "ekman": averaged,
        "dominant_emotion": dominant_emotion,
        "summary": f"由兩個模型同時分析後平均，主要情緒為 {dominant_emotion}",
    }


def analyze_with_two_ai(text: str, history_last10: List[Dict[str, Any]], typing: Dict[str, Any]):
    model_a = "meta-llama/llama-3.3-70b-instruct:free"
    model_b = "gpt-4o-mini"  # 如果你有另一個模型可用

    with ThreadPoolExecutor(max_workers=2) as executor:
        future_a = executor.submit(
            analyze_message,
            text=text,
            history_last10=history_last10,
            typing=typing,
            model=model_a,
        )
        future_b = executor.submit(
            analyze_message,
            text=text,
            history_last10=history_last10,
            typing=typing,
            model=model_b,
        )

        result_a = future_a.result()
        result_b = future_b.result()

    return average_two_results(result_a, result_b)
```

> 如果你使用的是 OpenRouter 或 Hugging Face router，兩個模型名稱可以是不同的 model id。

---

## 7. 你應該如何把它接到專案裡

### 7.1 建議接法：保留原本分析函式，新增一個上層並行函式

你可以保留原本的 analyze_message，然後新增一個上層函式專門做「同時分析」。

例如：
- 在 analyzer.py 裡新增 analyze_with_two_ai()
- 在 main.py 或 controller 裡呼叫它

### 7.2 連接方式

```python
from src.analyzer import analyze_with_two_ai

result = analyze_with_two_ai(text, history_last10, typing)
print(result)
```

這樣做的好處是：
- 不會破壞原本單一模型的功能
- 你現在的需求就是「同時分析」
- 之後如果要改成 3 個或 4 個 AI，也很容易擴充
- 方便維護與除錯

---

## 8. 進階版：可擴充成 n 個 AI 同時平均

如果你後面想要擴大成 3 個、4 個，建議把結構改成：

```python
from concurrent.futures import ThreadPoolExecutor


def analyze_with_multiple_ai(text, history_last10, typing, models):
    with ThreadPoolExecutor(max_workers=len(models)) as executor:
        futures = [
            executor.submit(analyze_message, text=text, history_last10=history_last10, typing=typing, model=model)
            for model in models
        ]
        results = [future.result() for future in futures]

    return average_multiple_results(results)
```

這樣就能做到「多模型同時分析」了。

---

## 9. 建議的實作順序

### 第一步：先讓兩個模型都能跑出結果
- 確認 analyze_message 能成功使用模型 A
- 確認 analyze_message 能成功使用模型 B

### 第二步：先做平均
- 先把六個情緒分數做平均
- 不要一開始就加太多複雜邏輯

### 第三步：加入 dominant_emotion
- 依照平均後的分數選主要情緒

### 第四步：整合進主流程
- 把結果回傳給你的 Node.js / Flask / API 端

---

## 10. 建議的資料格式

最終輸出建議長這樣：

```json
{
  "ekman": {
    "happiness": 72.5,
    "sadness": 18.0,
    "anger": 5.0,
    "fear": 10.0,
    "disgust": 3.5,
    "surprise": 12.0
  },
  "dominant_emotion": "happiness",
  "summary": "由兩個模型平均後得到的結果，主要情緒為 happiness"
}
```

這樣對後續前端顯示、資料庫儲存或 API 回傳都很方便。

---

## 11. 實務建議

### 11.1 先用最簡單版本
- 先用兩個模型各跑一次
- 先做數值平均
- 之後再做更精細的權重設計

### 11.2 建議做錯誤處理
- 如果其中一個模型失敗，是否要跳過或使用單模型結果
- 如果兩個模型結果差異很大，是否要紀錄警告

### 11.3 建議加入 log
- 記錄每次模型名稱、回傳時間、結果差異
- 之後方便除錯與調整

---

## 12. 結論

你這個專案最適合的做法是：
- 保留你目前的 analyze_message
- 新增一個多 AI 包裝函式
- 讓它依序呼叫兩個模型
- 取六個情緒分數的平均值
- 最後輸出整合結果

這樣不但能達到你想要的效果，也不需要大改整個架構。

如果你願意，我下一步可以直接幫你把這個設計落成實際程式碼，並整理成可直接放進 analyzer.py 的版本。