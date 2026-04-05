## 專案說明：AI 聊天小寵物（前端）

這是 SentientPet-AI 的**前端部分**，包含聊天介面、登入頁面與登入後的 Dashboard。

前端目前實作：
- 聊天 UI（訊息氣泡、typing 動畫、Enter 送出 / Shift+Enter 換行）
- 串接後端 AI API（`POST /api/ai/ask`），支援多輪對話歷史
- AI 回覆自動過濾思考過程，只顯示最終答案
- AI 回覆自動從簡體轉成繁體中文（使用 `opencc-js`）
- **登入功能**：串接後端驗證 API（`POST /api/auth/login`），成功後導向 AI 聊天主介面 (`index.html`)
- **註冊功能**：新增註冊表單與頁面切換功能，將呼叫假設的後端註冊 API（`POST /api/auth/register`）
- 首頁 (`index.html`) 加入登入狀態檢查，未登入會自動導回登入頁面

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

### `index.html` — AI 聊天主介面

應用程式的主要介面，提供 AI 聊天 UI。

- 頁面載入時會檢查登入狀態，未登入則自動跳轉至 `pages/login.html`
- 訊息歷史保存於記憶體中（頁面重整後清空）

### `pages/login.html` — 登入與註冊頁面

- 整合登入表單與註冊表單，可透過連結互相切換顯示
- **登入功能**：
    - 輸入帳號密碼後送出表單
    - 呼叫後端 `POST /api/auth/login`
    - 登入成功後自動跳轉至 `index.html`
    - 登入失敗則在表單下方顯示錯誤訊息
- **註冊功能**：
    - 提供使用者名稱、密碼與確認密碼輸入
    - 密碼與確認密碼不符時會提示錯誤
    - 呼叫假設的後端 `POST /api/auth/register` (需要後端實作)
    - 註冊成功後，提示使用者登入並自動切換回登入表單

**註：`pages/dashboard.html` 頁面目前已不再使用於前端導航流程中。**

---

## 技術細節

### `chat.js` — 聊天邏輯

- `handleSend()` 取得使用者輸入，更新訊息歷史，顯示 typing 動畫，呼叫 `callAPI()`
- `callAPI()` 將訊息與歷史送至後端 `POST /api/ai/ask`，兼容多種回傳格式（`reply`、`answer`、`message`、`text`、`result` 等欄位）
- `sanitizeAnswer()` 過濾 AI 回傳中的思考過程（`Thinking Process:` / `Final Choice:`），只顯示最終答案
- 收到回覆後，若 `window.toTraditional` 存在，自動轉換為繁體中文再顯示

### `login.js` — 登入與註冊邏輯

- 整合登入與註冊功能，包含：
    - 登入邏輯 (`login()`): 監聽登入表單提交，呼叫 `POST /api/auth/login`，處理登入成功後的 `localStorage` 儲存與頁面跳轉。
    - 註冊邏輯 (`register()`): 監聽註冊表單提交，檢查密碼一致性，呼叫假設的 `POST /api/auth/register`，並處理註冊成功後的提示與頁面切換。
- 提供 `showRegisterPanel()` 和 `showLoginPanel()` 函數，用於切換登入與註冊表單的顯示。
- 監聽「註冊」與「登入」連結的點擊事件，以切換表單。

### `dashboard.js` — (目前暫不使用)

- 此檔案目前已不直接參與前端的主要導航流程。

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

後端 API 位址目前設定為 `http://210.70.254.110:2237`，如有變更請同步修改 `login.js` 與 `chat.js` 中的 URL。

---

## 待辦事項

1. **後端註冊 API 實作**：請 Sam 在後端實作 `POST /api/auth/register` 端點，以支援前端的註冊功能。
2. **登出功能**：在 `index.html` 或其他頁面加入登出按鈕，清除 `localStorage` 中的使用者資訊，並導回 `login.html`。
3. **聊天記錄持久化**：目前頁面重整後歷史清空，可考慮存入 `localStorage` 或資料庫。
4. **Dashboard 頁面處理**：討論未來是否仍需 Dashboard 頁面，或將其功能合併到 `index.html`。

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
