# NGINX 設置自簽 SSL 憑證 (OpenSSL) 實作筆記

## 📋 概述
本筆記記錄如何在測試環境中使用 **OpenSSL** 產製自簽憑證（Self-Signed Certificate），並配置 **NGINX** 啟用 HTTPS 加密連線。

---

## 🛠 步驟一：使用 OpenSSL 產製憑證與私鑰

在 Linux 終端機執行以下指令，直接將檔案產出至 NGINX 指定目錄：

```bash
# 1. 確保 SSL 目錄存在
sudo mkdir -p /etc/nginx/ssl/

# 2. 生成私鑰 (.key) 與 憑證 (.crt)
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
-keyout /etc/nginx/ssl/nginx-selfsigned.key \
-out /etc/nginx/ssl/nginx-selfsigned.crt

```

### 🔑 參數說明：

* `req -x509`: 指定使用 X.509 憑證簽署請求 (CSR) 管理。
* `-nodes`: 跳過加密私鑰的步驟（讓 NGINX 重啟時不需輸入密碼）。
* `-days 365`: 憑證有效期為 1 年。
* `-newkey rsa:2048`: 同時產生新的 2048 位元 RSA 金鑰。

---

## ⚙️ 步驟二：配置 NGINX 設定檔

修改 `/etc/nginx/nginx.conf` 或 `/etc/nginx/conf.d/default.conf`，加入 SSL 區塊：

```nginx
server {
    listen 80;
    server_name localhost;
    # 將所有 HTTP 請求導向 HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name localhost;

    # 憑證路徑 (路徑務必準確)
    ssl_certificate     /etc/nginx/ssl/nginx-selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/nginx-selfsigned.key;

    # 安全性優化設定
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        root /usr/share/nginx/html;
        index index.html;
    }
}

```

---

## 🔍 步驟三：檢查與套用設定

每次修改設定後，務必進行語法檢查：

1. **語法測試**：
```bash
sudo nginx -t


```



```
   *預期輸出：nginx: configuration file ... syntax is ok / test is successful*

2. **重新載入 NGINX**：
   ```bash
   sudo systemctl reload nginx
   

```

---

## 🧪 步驟四：驗證結果

### 1. 終端機測試 (Curl)

由於是自簽憑證，需加上 `-k` (insecure) 參數忽略安全警告：

```bash
curl -k -I https://localhost

```

### 2. 瀏覽器測試

訪問 `https://your_server_ip`。

* **現象**：顯示「您的連線不是私人連線」。
* **原因**：自簽憑證未經第三方 CA 機構認證，在測試環境中點選「進階」>「繼續前往」即可。

---

## ⚠️ 常見錯誤排除 (Troubleshooting)

* **BIO_new_file() failed**:
* 原因：NGINX 找不到檔案。
* 解決：檢查 `/etc/nginx/ssl/` 下檔名是否拼錯（例如 `selfsigned` 拼成 `selfsigend`）。


* **Permission Denied**:
* 解決：確保檔案權限正確。


```bash
sudo chmod 644 /etc/nginx/ssl/nginx-selfsigned.crt
sudo chmod 600 /etc/nginx/ssl/nginx-selfsigned.key


```



```

---
> 💡 **進階建議**：若未來需上線正式環境，建議申請 **Let's Encrypt** 免費憑證以獲得瀏覽器信任。
