# NPM 安全漏洞修復紀錄：axios 安裝後的 audit fix

> 紀錄專案中 `brace-expansion`, `path-to-regexp`, `picomatch` 的漏洞修復過程。

## 📋 漏洞報告摘要
在執行 `npm install axios` 後，系統偵測到 3 個安全性漏洞：


| 套件名稱 | 風險程度 | 問題類型 | 影響範圍 |
| -------- | -------- | -------- | -------- |
| **brace-expansion** | Moderate | 記憶體耗盡 (DoS) | 處理特殊數列時導致程式卡死 |
| **path-to-regexp** | High | 正則表達式攻擊 (ReDoS) | 惡意路徑解析導致伺服器當機 |
| **picomatch** | High | 正則表達式攻擊 (ReDoS) | 檔案路徑比對異常 |

---

## 🛠️ 修復與檢查步驟

### 第一步：執行自動修復
這是最安全且建議的首選操作，`npm` 會在不破壞版本相容性（符合 semver）的前提下嘗試升級。

```bash
npm audit fix
```

### 第二步：檢查追蹤來源 (選做)
如果你想知道是哪個套件引進了這些漏洞，可以使用 `ls` 指令查看依賴樹狀圖：

```bash
# 查看是誰在使用 path-to-regexp
npm ls path-to-regexp
```

### 第三步：驗證修復結果
修復完成後，請再次掃描確保漏洞已消失：

```bash
npm audit
```
*如果顯示 `found 0 vulnerabilities`，代表專案現在是安全的。*

```bash
npm outdated
```
*更新/過時檢查 (Outdated Packages)
*說明： 列出專案中所有版本過舊的套件，顯示當前版本、想要版本 (wanted) 和最新版本 (latest) [5.10]。

---

## ⚠️ 進階處理 (若自動修復無效)
如果執行 `npm audit fix` 後漏洞依然存在，代表這些漏洞位於「主要版本 (Major version)」的變動中，必須手動處理：

1. **強制修復（小心使用）：**
   ```bash
   npm audit fix --force
   ```
   *注意：這可能會自動升級套件到不相容的新版本，建議執行後要跑一遍測試確認功能正常。*

2. **手動更新特定套件：**
   若漏洞來自特定的頂層套件，直接更新該套件即可。例如：
   ```bash
   npm install [套件名稱]@latest
   ```

---

## 📝 備註
* 這些漏洞通常存在於開發工具（如 Webpack, Vite）的依賴中，不一定會直接暴露在最終的 Production 環境，但建議仍需修復以確保開發環境安全。
