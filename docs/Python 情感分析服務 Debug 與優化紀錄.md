# Python 情感分析服務 Debug 與優化紀錄

## 📌 問題現象

* **錯誤訊息**：Node.js API 噴出 `500 Internal Server Error`，前端顯示 `AxiosError: Request failed with status code 500`。
* **錯誤根源**：
1. **併發處理不足**：Python 服務採單執行緒，多個請求排隊導致逾時（Connection Reset）。
2. **Worker Timeout**：AI 模型（OpenAI API）回應過慢，導致 Gunicorn 進程被強制殺掉（Worker Timeout）。
3. **錯誤處理缺失**：程式碼未捕捉例外，導致 API 崩潰時直接噴 500。



---

## 🛠 修復策略與步驟

### 1. 提升併發處理能力 (Gunicorn)

將單一 Python 進程改為 Gunicorn 多工處理，允許同時處理多個請求。

* **安裝**：進入虛擬環境執行 `pip install gunicorn`。
* **設定 Systemd**：
```ini
[Service]
ExecStart=/home/prometheus/project/Sentiment_Analysis/.venv/bin/gunicorn -w 2 -b 127.0.0.1:5000 main:app --timeout 120

```


* **關鍵變更**：將 `--timeout` 從預設值拉高至 **120 秒**，給予 AI API 緩衝時間。

### 2. 優化 Node.js 資料庫查詢

將資料庫存取方式從 `query()` 改為 `execute()`，並透過索引提升效能。

* **優化前**：`pool.query()` (較不安全且效能較低)
* **優化後**：
```javascript
const [rows] = await pool.execute(
    'SELECT sentiment_score, analyzed_at FROM Emotion_Tracker WHERE cs_id = ? ORDER BY analyzed_at ASC',
    [cs_id]
);

```


* **索引建議**：確保資料庫欄位建立索引以維持查詢速度：
```sql
CREATE INDEX idx_emotion_cs_id ON Emotion_Tracker(cs_id);

```



### 3. 加入 Python 防禦性程式碼 (Try-Except)

防止因外部 API 異常導致服務崩潰（噴 500）。

* **實作原則**：在 `analyzer.py` 中捕捉 `APITimeoutError` 與其他例外，並回傳友善的錯誤結構。
```python
try:
    resp = client.chat.completions.create(..., timeout=90.0)
except openai.APITimeoutError:
    return {"error": "Service Timeout"}, 504
except Exception as e:
    return {"error": "Internal Error"}, 500

```



---

## 💡 總結與檢核清單

* [x] 安裝並配置 Gunicorn 雙 Worker 運行
* [x] Systemd 服務 Timeout 已拉長至 120s
* [x] Node.js 查詢已改用 `pool.execute()`
* [x] 資料庫已針對 `cs_id` 建立索引
* [ ] (下一步) 確保 Node.js 端的 `axios` 有完整的 `try...catch` 捕捉機制

---

*記錄時間：2026-06-02*
*維護項目：情感分析服務 (Sentiment_Analysis)*
