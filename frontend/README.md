## 專案說明：AI 聊天小寵物（前端）

這是 SentientPet-AI 的**前端部分**，包含聊天介面、登入頁面與登入後的 Dashboard。

前端目前實作：
- 聊天 UI（訊息氣泡、typing 動畫、Enter 送出 / Shift+Enter 換行）
- 串接後端 AI API（`POST /api/ai/ask`），支援多輪對話歷史
- AI 回覆自動過濾思考過程，只顯示最終答案
- AI 回覆自動從簡體轉成繁體中文（使用 `opencc-js`）
- 登入功能，串接後端驗證 API（`POST /api/auth/login`），成功後導向 Dashboard
- Dashboard 頁面（取得使用者資料功能待後端 API 實作）

---

## 專案結構

```
frontend/
  pages/
    login.html       # 登入頁面
    dashboard.html   # 登入後的 Dashboard
  js/
    login.js         # 登入邏輯，串接 /api/auth/login
    dashboard.js     # Dashboard 邏輯（取得使用者資料，待實作）
    chat.js          # 聊天介面邏輯，串接 /api/ai/ask
  css/
    style.css        # 全站樣式
index.html           # 聊天介面主頁（入口）
```

---

## 頁面說明

### `index.html` — 聊天介面（入口）

應用程式的主入口，提供 AI 聊天 UI。

- 頁面載入後即可輸入訊息與 AI 對話
- 訊息歷史保存於記憶體中（頁面重整後清空）
- 頁面底部提供連結導向登入頁面

### `pages/login.html` — 登入頁面

- 輸入帳號密碼後送出表單
- 呼叫後端 `POST /api/auth/login`
- 登入成功後自動跳轉至 `dashboard.html`
- 登入失敗則在表單下方顯示錯誤訊息

### `pages/dashboard.html` — Dashboard

- 登入成功後的歡迎頁面
- 提供「取得使用者資料」按鈕（待後端 `/api/auth/me` 實作後串接）
- 提供登出連結，回到登入頁面

---

## 技術細節

### `chat.js` — 聊天邏輯

- `handleSend()` 取得使用者輸入，更新訊息歷史，顯示 typing 動畫，呼叫 `callAPI()`
- `callAPI()` 將訊息與歷史送至後端 `POST /api/ai/ask`，兼容多種回傳格式（`reply`、`answer`、`message`、`text`、`result` 等欄位）
- `sanitizeAnswer()` 過濾 AI 回傳中的思考過程（`Thinking Process:` / `Final Choice:`），只顯示最終答案
- 收到回覆後，若 `window.toTraditional` 存在，自動轉換為繁體中文再顯示

### `login.js` — 登入邏輯

- 監聽表單 submit 事件，防止頁面跳轉
- 取得帳號密碼後，以 `fetch` 呼叫 `POST /api/auth/login`
- 根據回傳的 `data.message` 判斷登入成功或失敗

### `dashboard.js` — Dashboard 邏輯

- 目前 `loadUser()` 為佔位函數，待後端 `/api/auth/me` 實作後串接

### 簡體轉繁體：`opencc-js`

在 `index.html` 中透過 CDN 載入：

```html
<script src="https://cdn.jsdelivr.net/npm/opencc-js@1.0.5/dist/umd/full.min.js"></script>
<script>
  window.toTraditional = OpenCC.Converter({ from: "cn", to: "tw" });
</script>
```

---

## 使用的前端套件

| 套件 | 用途 |
|------|------|
| [opencc-js](https://cdn.jsdelivr.net/npm/opencc-js@1.0.5/dist/umd/full.min.js) | 簡體轉繁體中文 |
| [axios](https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js) | HTTP 請求（login.html 引入） |
| [Vue 3](https://unpkg.com/vue@3/dist/vue.global.js) | UI 框架（login.html 引入，保留供後續使用） |
| [Google Fonts](https://fonts.google.com/) | Lora + DM Sans 字型 |

---

## API 對接說明

| Method | Endpoint | 說明 |
|--------|----------|------|
| `POST` | `/api/auth/login` | 登入，body 帶 `username` 與 `password`，成功回傳 `{ message: "login success" }` |
| `POST` | `/api/ai/ask` | 傳送訊息給 AI，body 帶 `message`、`history` 等欄位，回傳 AI 回覆 |

後端 API 位址目前設定為 `http://210.70.254.110:2235`，如有變更請同步修改 `login.js` 與 `chat.js` 中的 URL。

---

## 待辦事項

1. **Dashboard 用戶資料**：後端實作 `GET /api/auth/me` 後，串接至 `dashboard.js`
2. **登出功能**：實作 token 清除與登出導向邏輯
3. **登入狀態保護**：Dashboard 頁面加入未登入時自動導向登入頁的判斷
4. **聊天記錄持久化**：目前頁面重整後歷史清空，可考慮存入 localStorage 或資料庫

---

## 常見問題（FAQ）

### 1. 為什麼出現 `Failed to fetch`？

- 通常是 CORS 問題，或後端服務尚未啟動。
- 確認後端伺服器正在運行，且已允許前端來源的跨域請求。

### 2. 為什麼 AI 回覆顯示思考過程而不是最終答案？

- `chat.js` 的 `sanitizeAnswer()` 會自動過濾 `Thinking Process:` 與 `Final Choice:` 格式的思考過程。
- 若後端 AI 回傳格式有變動，請同步調整此函數的正則條件。

### 3. 為什麼出現 `500` 或 `503`？

- 通常是後端或上游 AI 服務的暫時性錯誤。
- 前端會在訊息區顯示 `⚠️ 發生錯誤：...`，可依錯誤訊息排查後端狀況。

---

## 版權與使用

此專案主要用於個人學習與測試。  
若將來要串接第三方模型服務，請遵守對方與各模型作者的授權條款與使用政策。
