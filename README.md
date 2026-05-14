# SentientPet

## Project Overview

`SentientPet-AI` is a backend demo project built with **Node.js + Express** and **MariaDB**. It implements a simple authentication flow and provides an example of how to connect a frontend login page to a backend API.

Key components:

- **Node.js + Express**: RESTful API server.
- **MariaDB**: Stores user credentials and related data.
- **Frontend (HTML/CSS/JS)**: Provides a Login page and a Dashboard page.

---

## Version Info

- Node.js: Recommended **LTS** (e.g., v20.x or v22.x)
- Express: `^4.18.2`
- MariaDB: `10.x` (installed via Ubuntu package manager)

---

## Installation & Setup

### 1. Install NVM (Node Version Manager)

```bash
sudo apt update
sudo apt install curl -y
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

### 2. Reload shell configuration

```bash
source ~/.bashrc
```

### 3. Install Node.js LTS

```bash
nvm install --lts
```

### 4. Verify Node.js and npm

```bash
node -v   # e.g. v20.x.x or v22.x.x
npm -v
```

---

## Project Initialization (backend)

```bash
mkdir backend
cd backend
npm init -y
```

---

## Install Core Dependencies (Express + MariaDB)

```bash
npm install express mariadb
```

---

## Project Structure (Example)

This project follows a simple MVC / layered structure. The current file layout is:

```
backend/
  server.js
  package.json
  package-lock.json
  README.md
  docker-compose.yaml
  dockerfile
  ecosystem.config.js
  .env
  .gitignore
  config/
    database.js
    setupDB.js
  controllers/
    aiController.js
    authController.js
    chatController.js
    saController.js
    test.js
  middleware/
    authMiddleware.js
  models/
    chatModel.js
    petModel.js
    userModel.js
  routes/
    ai.js
    auth.js
    chat.js
    pet.js
    sa.js
  services/
    aiService.js
  logs/
    access.log
  src/
    a.ini
frontend/
  home.html
  index.html
  README.md
  .gitignore
  css/
    emotionChart.css
    home.css
    login.css
    register.css
    style.css
  js/
    chat.js
    dashboard.js
    emotionChart.js
    login.js
  pages/
    dashboard.html
    login.html
  pet_selection/
    pet_selection.html
    pet_selection.css
    pet_selection.js
    pet_image/
      Green Sprout.png
      Pink Healer.png
      Sunny Spark.png
      pets.png
```

---

## MariaDB Connection

The backend connects to MariaDB via `backend/config/database.js` using the `mariadb` driver. Example configuration:

```js
const mariadb = require("mariadb")

const pool = mariadb.createPool({
  host: "localhost",
  user: "appuser",
  password: "password",
  database: "logindb",
  connectionLimit: 5
})

module.exports = pool
```

- **Database name**: `logindb`
- **Database user**: `appuser` (needs to be created in MariaDB)

If you can log in with `sudo mysql`, MariaDB is running correctly. Make sure to create the database and user:

```sql
CREATE DATABASE IF NOT EXISTS logindb;
CREATE USER IF NOT EXISTS 'appuser'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON logindb.* TO 'appuser'@'localhost';
FLUSH PRIVILEGES;
```

---

## Start & Test

1. Change to the backend folder:

```bash
cd backend
```

2. Start the server:

```bash
npm start
```

3. In your browser, visit:

- Login page: `http://localhost:5001/pages/login.html`
- Home page: `http://localhost:5001/`

---

## Main Features

- `/api/auth/login`: `POST` endpoint that expects `username` and `password` in JSON body. Returns `{ message: "login success" }` or an error message.
- Frontend `frontend/pages/login.html` + `frontend/js/login.js` send login requests and handle redirect logic.

---

## Suggested Improvements

1. **Password hashing**: Currently passwords are stored and compared as plain text. Use `bcrypt` to hash passwords.
2. **Authentication state**: Add JWT or session management to protect API endpoints.
3. **Error handling**: Improve API error responses and show clearer messages on the frontend.
4. **Frontend UX**: Add loading indicators, form validation, and better error display.

---

## pm2
- Restart
```bash
pm2 reload server
```

---
# 參考資料
[API 資料整合](https://hackmd.io/@sam21/B1C47Zqnbg)

[database 資料](https://hackmd.io/@sam21/ry4LDm-sZg)

---

# Document

[Docs](docs/README.md)

---

Happy building! If you'd like help expanding authentication, adding role-based access, or improving security, just say the word.
