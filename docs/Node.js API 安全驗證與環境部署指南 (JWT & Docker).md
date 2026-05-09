這份 HackMD 筆記整合了你提供的 JWT 驗證機制、Docker 配置以及專案目錄結構，並補充了實務開發中缺失的細節（如安全建議、Docker Compose 配合以及目錄架構規範）。

---

# 🛡️ Node.js API 安全驗證與環境部署指南 (JWT & Docker)

本文件說明如何結合 **JWT (JSON Web Token)** 進行身份驗證，並使用 **Docker + PM2** 進行標準化部署。

---

## 🔐 一、 JWT 身份驗證機制

JWT 是一種無狀態（Stateless）的驗證方式，適合分散式系統與 API 開發。

### 1. 驗證流程比較

| 方式 | 傳統 Session | JWT (推薦) |
| --- | --- | --- |
| **儲存位置** | 伺服器記憶體/資料庫 | 前端 (localStorage/Cookie) |
| **查詢負擔** | 每次都要查資料庫 | 伺服器僅需解密驗證，不查庫 |
| **擴充性** | 較差 (跨伺服器需共享 Session) | 極佳 (Token 帶在身上隨處可用) |

### 2. JWT 結構拆解

一個 Token 由三部分組成，中間以 `.` 隔開：
`Header.Payload.Signature`

* **Header**: 宣告類型與加密演算法 (如 HS256)。
* **Payload**: 存放使用者資訊 (如 `user_id`)。**請勿存放密碼等敏感資料**，因為它是可以被 Base64 解碼的。
* **Signature**: 防止篡改的核心。由 `Header + Payload + JWT_SECRET` 計算而成。

### 3. JWT_SECRET 安全規範

`JWT_SECRET` 是伺服器的命根子，必須儲存在 `.env` 檔案中，嚴禁上傳至 GitHub。

**產生強密鑰指令：**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

```

---

## 🐳 二、 Docker 與 PM2 部署

為了確保程式在不同環境的一致性，我們使用 Docker 容器化技術，並搭配 PM2 管理進程。

### 1. Dockerfile 配置

在專案根目錄建立 `Dockerfile`：

```dockerfile
# 使用輕量級 Node.js 映像檔
FROM node:18-alpine

# 安裝 PM2 
RUN npm install pm2 -g

WORKDIR /usr/src/app

# 先複製 package.json 以利用快取層優化效能
COPY package*.json ./
RUN npm install --production

# 複製其餘程式碼
COPY . .

# 使用 pm2-runtime 啟動 (專為 Docker 設計，保持前台執行防止容器退出)
CMD ["pm2-runtime", "start", "app.js", "--name", "api-service"]

```

### 2. 補充：Docker Compose (推薦)

若你的 API 需要搭配資料庫（如 MongoDB/PostgreSQL），建議建立 `docker-compose.yml`：

```yaml
services:
  api:
    build: .
    ports:
      - "3000:3000"
    env_file: .env
    restart: always

```

---

## 📂 三、 專案架構說明 (Folder Structure)

良好的目錄結構能提升代碼的可維護性：

### `services/` 目錄

此層負責處理**外部對接邏輯**與**複雜業務運算**。

* **aiService.js**:
* 負責封裝與 AI 模型（如 OpenAI/Gemini）的 API 對接。
* 處理 Prompt 模板與 Token 消耗控制。


* **authService.js** (建議增加):
* 負責 `jwt.sign()` (簽發) 與 `password.hash()` (加密)。



### `middleware/` 目錄 (建議增加)

* **authMiddleware.js**:
* 攔截請求並解析 `Header: Authorization`。
* 驗證失敗回傳 `401 Unauthorized`。



---

## 🔄 四、 完整 API 請求生命週期

1. **Login**: 使用者傳送帳密 -> `authService` 驗證 -> 回傳 **JWT Token**。
2. **Storage**: 前端將 Token 存入 `localStorage`。
3. **Request**: 前端請求 API，在 Header 帶上 `Authorization: Bearer <TOKEN>`。
4. **Middleware**: `authMiddleware` 攔截 -> `jwt.verify(token, JWT_SECRET)`。
5. **Controller**: 驗證成功 -> 執行業務邏輯 (如調用 `aiService`)。
6. **Response**: 回傳 JSON 資料。

---

> **⚠️ 注意事項：**
> 1. JWT 預設是**不可撤回**的。若要實現「強制登出」，需搭配 Redis 實作黑名單。
> 2. Docker 部署時，務必在 `.dockerignore` 中排除 `node_modules` 以縮減映像檔體積。
> 
>