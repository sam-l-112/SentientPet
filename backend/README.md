# Backend

### Installing Industry-Standard Tool Nodemon (Advanced and Most Commonly Used)

This is the auxiliary tool I mentioned in my previous response, and it's the current industry-standard configuration for development.

1. **Install Nodemon (specify as development environment only):**
In the terminal, enter:

```bash
npm install nodemon --save-dev
```

---

**Modify `package.json` settings:**

Open the package.json file in your project, find the `"scripts"` section, and add a line `"dev": "nodemon server.js"`, so it looks like this:

```bash
"scripts": {
  "test": "echo \"Error: no test specified\" && exit 1",
  "dev": "nodemon server.js"
}
```

---

**Future Startup Method:**

In the future, when you write code for development, just enter the following command, and Nodemon will start the server for you and automatically restart it every time you save:

```bash
npm run dev
```

---

## File Development Format and Function Description

- **File Format:** This is a Markdown (.md) file, which uses simple text formatting syntax to create structured documents. Markdown is widely used for README files, documentation, and notes because it's easy to read and write, and can be rendered into HTML.

---

## Backend Directory Structure and File Descriptions

This section describes the development format, purpose, and function of each file and directory under the `backend/` folder. The backend is built using Node.js and Express.js, following a typical MVC (Model-View-Controller) architecture with additional layers for configuration, middleware, routes, and services.

### Root Files
- **package.json** (JSON format): Defines the project dependencies, scripts, and metadata for the Node.js backend. It specifies packages like Express, Nodemon, and others needed for the server.
- **README.md** (Markdown format): This documentation file providing setup instructions, development guidelines, and file descriptions for the backend.
- **server.js** (JavaScript format): The main entry point for the backend server. It initializes the Express app, sets up middleware, connects to the database, and starts the server on a specified port.

### config/ Directory
- **database.js** (JavaScript format): Contains database connection configuration, such as MongoDB or other database setup details.
- **setupDB.js** (JavaScript format): Handles database initialization, including creating collections, indexes, or seeding initial data.

### controllers/ Directory
- **authController.js** (JavaScript format): Manages authentication logic, including user login, registration, and token generation/validation.
- **chatController.js** (JavaScript format): Handles chat-related operations, such as sending/receiving messages, managing chat sessions, and integrating with AI services.

### middleware/ Directory
- **authJWT.js** (JavaScript format): Middleware for JWT (JSON Web Token) authentication. It verifies tokens in incoming requests to protect routes.

### models/ Directory
- **chatModel.js** (JavaScript format): Defines the data model/schema for chat messages and conversations, typically using Mongoose for MongoDB.
- **petModel.js** (JavaScript format): Defines the data model/schema for pet-related data, such as pet profiles or information.
- **userModel.js** (JavaScript format): Defines the data model/schema for user accounts, including fields like username, email, and password.

### routes/ Directory
- **auth.js** (JavaScript format): Defines API routes for authentication endpoints, such as `/login`, `/register`, and `/logout`.
- **chat.js** (JavaScript format): Defines API routes for chat functionality, such as sending messages or retrieving chat history.
- **pet.js** (JavaScript format): Defines API routes for pet-related operations, such as creating or updating pet profiles.
---
## JWT 是什麼？

**JWT = JSON Web Token**，是一種登入驗證的機制。

---

## 登入流程比較

**傳統 Session 方式**
```
使用者登入 → 伺服器記住你 → 每次請求都查資料庫確認身份
```

**JWT 方式**
```
使用者登入 → 伺服器發一張「通行證」(Token) → 之後每次請求帶著這張通行證
           → 伺服器驗證通行證就好，不用查資料庫
```

---

## JWT 長什麼樣子

```
eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxfQ.abc123xyz
        │                      │                  │
     Header               Payload             Signature
   (加密方式)           (存放的資料)          (防偽簽名)
```

Payload 裡面存的就是你的資訊：
```json
{
  "user_id": 1,
  "username": "小明",
  "exp": 1234567890
}
```

---

## JWT_SECRET 是什麼

就是用來**產生防偽簽名的密鑰**，只有你的伺服器知道。

```env
JWT_SECRET=abc123xyz隨便打一串沒人猜得到的字
```

> ⚠️ 這串字絕對不能外洩，外洩的話別人可以偽造 Token 冒充任何使用者！

---

## 實際使用流程

```
1. 使用者登入
   POST /api/auth/login { username, password }
           ↓
   伺服器驗證成功，用 JWT_SECRET 產生 Token
   回傳 { token: "eyJhbG..." }

2. 前端把 Token 存起來
   localStorage.setItem('token', 'eyJhbG...')

3. 之後每次 API 請求都帶上 Token
   Header: Authorization: Bearer eyJhbG...
           ↓
   authMiddleware 驗證 Token 是否合法
   合法 → 放行，並把 user_id 注入 req.user
   不合法 → 回傳 401 請先登入
```

---

## JWT_SECRET 怎麼設定

隨便打一串夠長夠亂的字就好：

```env
JWT_SECRET=s3nt13nt_p3t_2025_super_secret_key_!@#
```

或是用終端機產生：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

這樣會產生一串像這樣的隨機字串：
```
a3f8c2d1e9b4f7a0c5d2e8f1b6a3c9d4e7f2b5a8c1d6e3f0b7a4c2d9e6f3b0
```

### services/ Directory
- **aiService.js** (JavaScript format): Contains logic for integrating with AI services, such as processing chat inputs through an AI model for responses.