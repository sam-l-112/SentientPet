# 情感分析系統 (Node.js + Python) 資料庫與日誌除錯維護指南

本筆記記錄了 `Emotion_Tracker` 系統在進行資料庫欄位變更（將舊的縮減欄位改為文字摘要 `TEXT`）、Python 服務狀態檢查、以及 Node.js (PM2) 系統除錯時的核心指令與操作流程。

---

## 💾 一、 資料庫欄位變更 (MariaDB / MySQL)

當需要調整 `Emotion_Tracker` 資料表的欄位型態或名稱時，必須依序執行刪除舊欄位與建立新欄位的操作。

### 1. 刪除原有欄位

若資料表中已存在舊有且型態不符（例如原本是 `smallint`）的 `summary` 欄位，需先將其刪除：

```sql
ALTER TABLE Emotion_Tracker DROP COLUMN summary;

```

* **說明**：`DROP COLUMN` 會直接將指定欄位從資料表中連同資料一起永久刪除，執行前請務必確認資料已備份或不需留存。

### 2. 新增文字摘要欄位

接著重新建立一個符合長期紀錄、型態為 `TEXT` 的 `summary` 欄位：

```sql
ALTER TABLE Emotion_Tracker ADD COLUMN summary TEXT;

```

* **說明**：`ADD COLUMN` 用於擴充資料表結構。改為 `TEXT` 型態後，可容納長度極長的 AI 生成文字摘要（上限為 65,535 字元），徹底解決原本限制為數字型態時產生的寫入撞車問題。

---

## 🐍 二、 Python 服務維護與進程查詢

情緒分析的核心邏輯由 Python 服務（通常運行在 Port 5000）處理。

### 1. 檢查 Python 進程是否存在

使用以下命令於 Linux 系統中撈出背景正在執行的 Python 主程式（以 `main.py` 為例）：

```bash
ps aux | grep main.py

```

* **參數詳細說明**：
* `ps`：Process Status，查看系統當前的進程狀態。
* `a`：顯示所有終端機底下的進程。
* `u`：顯示進程的擁有者（User）與詳細 CPU/記憶體消耗。
* `x`：顯示沒有終端機控制的背景進程（通常守護進程/背景服務都在此列）。
* `| grep main.py`：利用管線命令（Pipe）過濾，只顯示名稱包含 `main.py` 的整行結果。


* **應用場景**：當 Node.js 回報 `NVIDIA Gemini 失敗` 或 `Python service 無回應` 時，優先執行此指令確認 Python 進程是否死機。

### 2. 查看 Python 系統服務日誌

若 Python 是透過 Linux 的 `systemd`（系統服務）進行託管，可使用以下指令調閱即時日誌：

```bash
journalctl -u python -f --no-tail

```

* **日誌解讀重點**：
* 出現 `* Detected change in '.../analyzer.py', reloading`：代表 Python 的熱重載機制（如 Flask Debug mode）偵測到代碼修改並重啟。
* 出現 `127.0.0.1 - - [日期時間] "POST /analyze HTTP/1.1" 200 -`：代表 Node.js 有成功發送請求，且 Python 成功處理並回傳了 200（OK）狀態碼。



---

## 🟢 三、 Node.js 後端維護與 PM2 日誌除錯

Node.js 主程式透過 PM2（Production Process Manager）進行背景管理。以下是排查 `500 Internal Server Error` 最核心的工具命令。

### 1. 查詢 PM2 綜合日誌（標準輸出 + 錯誤）

查看名為 `server` 的應用程式最新的即時動態日誌：

```bash
pm2 logs server --lines 40

```

* **說明**：`--lines 40` 代表預先印出最後 40 行的歷史日誌，隨後保持連線並即時輸出後續的所有系統行為（包含 `console.log` 的自訂輸出）。

### 2. 精準定位錯誤日誌 (Error Logs)

如果前端發生 500 報錯，但綜合日誌洗得太快，應使用 `--err` 參數**僅隔離出錯誤訊息**：

```bash
pm2 logs server --err --lines 30

```

* **經典犯罪現場解讀**：
* **狀況 A：資料庫約束失敗**
```text
sqlMessage: 'CONSTRAINT `Emotion_Tracker.valence` failed...'
code: 'ER_CONSTRAINT_FAILED'

```


👉 *解法*：代表寫入的數值違反了資料庫的 Check 約束（例如丟了 `-60` 給不允許負數的欄位），需檢查 Controller 映射邏輯或調校資料庫欄位。
* **狀況 B：AI 介接超時**
```text
NVIDIA Gemini 失敗: timeout of 30000ms exceeded

```


👉 *解法*：代表遠端模型伺服器塞車、斷線或 API Key 失效。此時應在 Node.js 中加入防呆（Fallback）預設值，避免系統直接崩潰。
* **狀況 C：程式碼語法/邏輯錯誤**
```text
SA Controller Error: Error: Invalid emotion data from Python service
at exports.handleSentimentAnalysis (.../saController.js:34:19)

```


👉 *解法*：看清楚後方的行數（如 `saController.js:34`）。這代表 Python 傳回的 JSON 格式與 Node.js 內 `if` 條件預期的欄位型態（如 `typeof` 檢查）不符。



### 3. 清理 PM2 快取並強制重啟

當修改了 `saController.js` 後，若發現 PM2 依然在噴舊行數的錯誤，代表記憶體快取未刷新，必須執行「終極重啟」：

```bash
pm2 delete server && pm2 kill && pm2 start server.js --name "server"

```

* **步驟解說**：
1. `pm2 delete server`：將該進程從 PM2 列表中徹底移除。
2. `pm2 kill`：關閉 PM2 守護進程，強迫釋放所有殘留的記憶體快取與背景死線。
3. `pm2 start ...`：全新乾淨地拉起後端專案。