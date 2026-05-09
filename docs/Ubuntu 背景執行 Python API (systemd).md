# Ubuntu 背景執行 Python API (systemd) 與除錯指南

這份筆記紀錄了如何使用 `systemd` 在 Ubuntu 系統上將 Python (Flask) 專案設定為背景服務，並包含常用管理指令與「Port 被佔用」的除錯流程。

---

## 1. 服務管理基本指令

當你在 `/etc/systemd/system/` 底下建立或修改了 `sentiment.service` 設定檔後，請使用以下指令來管理你的背景服務：

ex:

```ini
[Unit]
Description=Sentiment Analysis Service with Venv
After=network.target

[Service]
# 使用你的實際使用者名稱，避免 root 權限問題
User=prometheus 

# 設定專案的絕對路徑作為工作目錄
WorkingDirectory=/home/prometheus/project/Sentiment_Analysis

# 指向你專屬的 .venv 虛擬環境中的 python
ExecStart=/home/prometheus/project/Sentiment_Analysis/.venv/bin/python main.py

# 崩潰後 5 秒自動重啟
Restart=always
RestartSec=5

# 強制 Python 不使用緩衝區，這樣 log 才會即時顯示
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

* **重新載入設定檔 (重要！)**
    只要有修改過 `.service` 檔案內容，就必須執行這行讓系統重新讀取：
    ```bash
    sudo systemctl daemon-reload
    ```

* **啟動服務**
    讓程式開始在背景執行：
    ```bash
    sudo systemctl start sentiment
    ```

* **停止服務**
    當你需要暫停程式（例如：要手動測試或修改程式碼時）：
    ```bash
    sudo systemctl stop sentiment
    ```

* **查看服務狀態**
    用來確認程式是否正常運作。正常狀態會顯示綠色的 `active (running)`；若啟動失敗則會顯示 `exit-code` 或 `bad-setting`：
    ```bash
    sudo systemctl status sentiment
    ```

---

## 2. 日誌 (Log) 查看指令

當服務交給 `systemd` 在背景執行後，我們無法直接在終端機看到 Python 的 `print()` 或報錯訊息。這時必須透過 `journalctl` 來查看：

* **查看最新的 50 行歷史日誌 (除錯專用)**
    當服務啟動失敗（狀態顯示 exit-code）時，使用這行指令把錯誤訊息直接印在畫面上找 Bug：
    ```bash
    journalctl -u sentiment -n 50 --no-pager
    ```
    > 參數說明：`-u` 指定服務名稱，`-n 50` 顯示最後 50 行，`--no-pager` 直接輸出到畫面而不進入分頁模式。

* **即時監聽日誌 (監控專用)**
    當服務正常執行中，你想看即時的 API 請求紀錄或 `print()` 輸出，就用這行。它會像平常跑終端機一樣持續滾動更新。
    ```bash
    journalctl -u sentiment -f
    ```
    > 提示：看完後按下 `Ctrl + C` 即可跳出。

---

## 3. 常見錯誤排除：Port 5000 被佔用

**【情境說明】**
使用 `systemctl status` 發現服務無法啟動 (exit-code)，接著使用 `journalctl` 查看日誌，發現出現以下錯誤：
> `Address already in use`
> `Port 5000 is in use by another program.`

這通常是因為先前手動執行的 Python 測試尚未完全關閉，導致背景仍有程式佔用著 5000 埠。

**【解決步驟】**

**步驟一：找出佔用 Port 的元兇 (PID)**
透過 `lsof` 指令查看是哪個 Process ID (PID) 佔用了 5000 埠：
```bash
sudo lsof -i :5000

```

*執行後會看到類似下方的列表，請記住 `PID` 欄位下方的數字（例如：12345）：*

> `COMMAND   PID       USER   FD   TYPE DEVICE SIZE/OFF NODE NAME`
> `python  12345 prometheus    3u  IPv4 123456      0t0  TCP *:5000 (LISTEN)`

**步驟二：強制終止該程式**
使用 `kill -9` 指令加上剛剛查到的 PID，把佔用資源的舊程式砍掉：

```bash
sudo kill -9 12345   # 請將 12345 替換成你實際查到的 PID

```

**步驟三：重新啟動 systemd 服務**
Port 5000 空出來後，就能讓系統服務順利接管並啟動了：

```bash
sudo systemctl start sentiment
sudo systemctl status sentiment  # 確認是否恢復 active (running)

```

*以後如果你想即時查看 API 的存取狀況或 print 出來的訊息，只要隨時輸入這行指令就可以了
```bash
journalctl -u sentiment -f
```