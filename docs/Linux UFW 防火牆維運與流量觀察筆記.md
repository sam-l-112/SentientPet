# 🛡️ Linux UFW 防火牆維運與流量觀察筆記

本筆記整理了 UFW (Uncomplicated Firewall) 的常用指令、規則操作，以及如何透過 Log 觀察網路流量與異常行為。

---

## 一、 查看目前防火牆規則

在調整規則前，必須先確認目前的狀態與規則順序。

| 指令 | 說明 |
| :--- | :--- |
| `sudo ufw status` | 查看基本狀態 (哪些 Port 開放中) |
| `sudo ufw status verbose` | 查看詳細狀態 (包含預設政策、日誌層級) |
| `sudo ufw status numbered` | **(最推薦)** 以編號顯示規則，方便後續刪除 |

---

## 二、 如何操作防火牆規則

### 1. 允許連線 (Allow)
* **依服務名稱：** `sudo ufw allow ssh`
* **依 Port 號：** `sudo ufw allow 80/tcp`
* **指定 IP 存取：** `sudo ufw allow from 192.168.1.100 to any port 22`

### 2. 禁止連線 (Deny / Reject)
* `sudo ufw deny 5001` (主動拒絕 5001 連接埠)

### 3. 刪除規則 (Delete)
* **先查編號：** `sudo ufw status numbered`
* **執行刪除：** `sudo ufw delete [規則編號]` (例如：`sudo ufw delete 2`)

---

## 三、 關於「Logging On」後的觀察

當執行 `sudo ufw logging on` 後，系統會將攔截到的封包資訊記錄在 `/var/log/ufw.log`。

### 1. 監聽日誌 (Real-time Monitoring)
使用 `tail -f` 可以即時看到哪些 IP 正在嘗試攻擊或連線到你的主機：
```bash
sudo tail -f /var/log/ufw.log

```

### 2. 解讀 Log 內容

一條典型的日誌如下：
`[UFW BLOCK] IN=eth0 OUT= SRC=1.2.3.4 DST=192.168.1.5 PROTO=TCP SPT=45678 DPT=22`

* **[UFW BLOCK]**: 代表此連線被防火牆阻擋。
* **SRC**: 發起連線的來源 IP (可能是攻擊者)。
* **DST**: 你的伺服器 IP。
* **DPT**: 目標連接埠 (Destination Port)。若 DPT=22 代表有人在掃描你的 SSH。

---

## 四、 進一步觀察網路流量 (進階工具)

除了 UFW 日誌，你可以配合以下指令深入觀察系統網路狀態：

### 1. 查看哪些程式正在監聽 (Listen)

確認防火牆開了 Port 之後，後端是否有程式在跑：

```bash
sudo ss -tunlp
# -t (tcp), -u (udp), -n (數字顯示), -l (監聽中), -p (顯示程序名稱)

```

### 2. 查看即時流量負載 (iftop)

如果覺得網路很慢，想看是哪個連線佔用頻寬 (需先安裝：`sudo apt install iftop`)：

```bash
sudo iftop -n

```

### 3. 統計 Log 中的攻擊者排行

如果你想知道最近誰最常被防火牆封鎖：

```bash
sudo grep "[UFW BLOCK]" /var/log/ufw.log | cut -d " " -f 10 | cut -d "=" -f 2 | sort | uniq -c | sort -nr | head -n 10

```

---

## 五、 最佳實踐建議

1. **預設阻擋全部 (Default Deny)：** UFW 預設通常是 `deny incoming`，這很安全。
2. **SSH 限制：** 盡量不要 `allow Anywhere` 到 Port 22，建議使用 `limit` 規則防止暴力破解：
* `sudo ufw limit ssh/tcp`


3. **定期檢查：** 每個月執行一次 `sudo ufw status` 檢查是否有過期的測試規則沒刪除。
