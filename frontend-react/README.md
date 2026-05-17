# SentientAI Frontend (React + Vite)

新版前端，取代 `frontend/`。**後端 API 不需要任何改動**（只要加一行 CORS 白名單）。

---

## 🚀 開發起步（第一次）

### 1. 裝 Node.js
LTS 版（v20 或 v22）：https://nodejs.org

確認：
```bash
node -v
npm -v
```

### 2. 安裝套件
```bash
cd frontend-react
npm install
```

### 3. 建本機環境變數檔
複製範本：
```bash
cp .env.example .env
```
預設 `VITE_API_BASE=http://210.70.254.110:2237`（後端位址），需要的話自己改。

### 4. 啟動 dev server
```bash
npm run dev
```
瀏覽器自動開 `http://localhost:5173`，**檔案存檔即時熱重載**。

---

## 📦 部署到實驗室電腦

### 在你本機 build：
```bash
npm run build
```
產生 `dist/` 資料夾，裡面是純 HTML + JS + CSS。

### 把 `dist/` 內容傳給後端組員，請他：
1. 放到 nginx 的網站根目錄（取代原本 `frontend/`）
2. 改 nginx config，加上：
   ```nginx
   location / {
       root /path/to/dist;
       try_files $uri /index.html;   # SPA 路由必加
   }
   ```
3. `sudo nginx -s reload`

---

## ⚠️ 後端唯一要做的事（一次性，3 分鐘）

請後端組員在實驗室電腦的 `backend/.env` 加一行：
```
FRONTEND_URL_VITE=http://localhost:5173
```

並改 `backend/server.js` 的 CORS 設定，把 `process.env.FRONTEND_URL_VITE` 加進 `origin` 陣列：
```js
app.use(cors({
    origin: [
        process.env.FRONTEND_URL,
        process.env.FRONTEND_URL_LH,
        process.env.FRONTEND_URL_NW,
        process.env.FRONTEND_URL_I,
        process.env.FRONTEND_URL_VITE,   // ← 新增
    ].filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}))
```

然後重啟：
```bash
pm2 reload server
```

---

## 📁 專案結構

```
frontend-react/
├── package.json
├── vite.config.js
├── .env                          # 本機環境變數（不入 git）
├── .env.example                  # 範本
├── index.html                    # Vite 入口
└── src/
    ├── main.jsx                  # React 入口
    ├── App.jsx                   # 主邏輯：路由 + API + 狀態
    ├── lib/
    │   ├── api.js                # axios 包裝 + 所有後端 API
    │   ├── sanitize.js           # 清理 AI 回覆的 <think> 標籤
    │   └── opencc.js             # 簡轉繁
    ├── components/
    │   ├── LavaBackground.jsx    # 六顆情緒光暈（動態大小/亮度）
    │   ├── AuthCard.jsx          # 登入 / 註冊
    │   ├── ChatShell.jsx         # 聊天介面
    │   └── EmotionPanel.jsx      # 情緒分析面板（折線 + 雷達 + 六格）
    └── styles/
        ├── colors_and_type.css   # Design system 色票 + 字型
        └── app.css               # 所有畫面樣式
```

---

## 🔌 對應的後端 API（不變）

| Method | 路徑 | 用途 |
|---|---|---|
| POST | `/api/auth/login` | 登入 |
| POST | `/api/auth/register` | 註冊 |
| POST | `/api/ai/sessions` | 建立對話 session |
| GET | `/api/ai/sessions/:cs_id/messages` | 取得對話歷史 |
| POST | `/api/ai/sessions/:cs_id/messages` | 送訊息給 AI |
| POST | `/api/sa` | 情緒分析 |

所有需要登入的請求都會自動帶 `Authorization: Bearer <token>`（在 `src/lib/api.js` 用 axios interceptor 處理）。

---

## 🐛 常見問題

**Q: 看到 `CORS blocked`？**
A: 後端組員還沒加白名單。請他加 `FRONTEND_URL_VITE` 並重啟 PM2。

**Q: 登入成功後一直跳回登入頁？**
A: 開 DevTools → Application → Local Storage → 看有沒有 `token` 跟 `user`。沒有的話表示後端 response 格式不對，看 Network 確認。

**Q: 聊天送不出？**
A: 看 Network 看 `/api/ai/sessions` 是否成功（要先有 `cs_id` 才能送訊息）。token 過期會回 401/403，登出再登入。

**Q: 情緒面板沒更新？**
A: 看 Network 確認 `/api/sa` 回 `{ success: true, data: {...} }`。後端 Python 服務沒開時 SA 會失敗，但聊天不受影響。
