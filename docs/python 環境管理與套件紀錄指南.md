---
# Python 環境管理與套件紀錄指南

在使用 Python 進行開發（如：`Sentiment_Analysis` 專案）時，良好的環境隔離與套件紀錄習慣，能有效避免版本衝突，並確保程式碼在不同設備上都能順利執行。

---

## 🛠 一、 虛擬環境管理 (`venv`)

虛擬環境（Virtual Environment）能為每個專案建立獨立的運行空間。

### 1. 建立虛擬環境

在專案根目錄下執行，這會建立一個名為 `.venv` 的資料夾。

```bash
python3 -m venv .venv

```

### 2. 啟動與切換環境

根據作業系統不同，指令略有差異：

* **Linux / macOS:**
```bash
source .venv/bin/activate

```


* **Windows (PowerShell):**
```bash
.\.venv\Scripts\Activate.ps1

```



### 3. 退出虛擬環境

當結束開發工作時，輸入以下指令即可回到系統環境：

```bash
deactivate

```

---

## 📦 二、 套件安裝與管理 (`pip`)

### 1. 查看目前已安裝套件

顯示目前環境中所有的套件名稱與版本：

```bash
pip list

```

### 2. 導出環境清單 (專業推薦)

為了讓其他人（或未來的自己）能重建相同的開發環境，建議將套件資訊紀錄至 `requirements.txt`：

```bash
pip freeze > requirements.txt

```

### 3. 從清單批次安裝

在新環境中，只需一個指令就能安裝所有必要的套件：

```bash
pip install -r requirements.txt

```

---

## 💡 三、 常見問題排除 (Troubleshooting)

### ⚠️ NumPy 初始化失敗問題

若你看到以下警告：

> `UserWarning: Failed to initialize NumPy: No module named 'numpy'`

**原因：** 你的環境中雖然安裝了 `PyTorch`，但缺少了與之搭配的 `NumPy` 數值運算庫。
**解決方法：** 請在虛擬環境啟動狀態下安裝 NumPy：

```bash
pip install numpy

```

---

## 📝 四、 實務操作心法

1. **`.gitignore` 設定**：
記得將 `.venv/` 資料夾加入 `.gitignore` 中，不要將整個虛擬環境上傳到 Git。我們只需上傳 `requirements.txt` 即可。
2. **先啟動，後安裝**：
務必確認終端機提示字元前方出現 `(.venv)` 字樣後，再進行 `pip install`，否則套件會安裝到系統全域環境中，導致管理困難。

---

> **Tip:** 定期更新 `requirements.txt` 是保持專案健康的關鍵動作！