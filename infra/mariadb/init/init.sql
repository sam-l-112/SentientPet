-- 確保使用正確的編碼來支援表情符號 (AI 寵物可能需要)
CREATE DATABASE IF NOT EXISTS Sentient_pet
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

-- SET NAMES utf8mb4;
-- SET FOREIGN_KEY_CHECKS = 0;

-- 1. 使用者資料表
CREATE TABLE users (
    user_id    INT           NOT NULL AUTO_INCREMENT,
    username   VARCHAR(50)   NOT NULL,
    password   VARCHAR(255)  NOT NULL,          -- 請用 bcrypt 加密後存入
    email      VARCHAR(100)  NOT NULL,
    created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id),
    UNIQUE KEY uq_users_username (username),
    UNIQUE KEY uq_users_email    (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. 對話表資料
CREATE TABLE chat_sessions (
    user_id    INT           NOT NULL,
    chat_session_time_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,  -- 最後對話時間自動更新
    
    PRIMARY KEY (user_id,chat_session_time_date),
    CONSTRAINT fk_cs_user
        FOREIGN KEY (user_id) REFERENCES users (user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;



-- 3. 對話訊息資料
CREATE TABLE messages (
    user_id    INT           NOT NULL,
    chat_session_time_date TIMESTAMP NOT NULL,
    role       VARCHAR(10)  NOT NULL,
    
    content    TEXT          NOT NULL,
    message_time_date TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (user_id,chat_session_time_date,message_time_date),

    CONSTRAINT fk_mes_session
        FOREIGN KEY (user_id, chat_session_time_date) REFERENCES chat_sessions(user_id, chat_session_time_date)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



-- CREATE TABLE IF NOT EXISTS `users` (
--   `id` INT AUTO_INCREMENT PRIMARY KEY,
--   `username` VARCHAR(50) NOT NULL UNIQUE COMMENT '使用者名稱',
--   `email` VARCHAR(100) UNIQUE COMMENT '電子郵件',
--   `password_hash` VARCHAR(255) NOT NULL COMMENT '雜湊後的密碼',
--   `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--   `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. 寵物基本資訊表 (SentientPet 核心)
-- CREATE TABLE IF NOT EXISTS `pets` (
--   `pet_id` INT AUTO_INCREMENT PRIMARY KEY,
--   `user_id` INT NOT NULL,
--   `pet_name` VARCHAR(50) NOT NULL,
--   `species` VARCHAR(30) DEFAULT 'default' COMMENT '寵物種類',
--   `level` INT DEFAULT 1,
--   `exp` INT DEFAULT 0,
--   `health` INT DEFAULT 100,
--   `mood` INT DEFAULT 100 COMMENT '心情值，AI 判斷用',
--   `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--   FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. AI 對話與心情歷史紀錄 (用於 RAG 或長期記憶)
-- CREATE TABLE IF NOT EXISTS `pet_memories` (
--   `memory_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
--   `pet_id` INT NOT NULL,
--   `user_message` TEXT,
--   `ai_response` TEXT,
--   `sentiment_score` DECIMAL(3,2) COMMENT 'AI 分析的情感分數',
--   `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--   FOREIGN KEY (`pet_id`) REFERENCES `pets`(`pet_id`) ON DELETE CASCADE
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. 插入開發用測試帳號 (密碼範例為: password123)
-- 注意：生產環境應移除此段
-- INSERT IGNORE INTO `users` (`username`, `email`, `password_hash`) VALUES 
-- ('test_user', 'test@example.com', '$2b$10$EixZ9.V.F2M5m7Jm6Y.1Ge/Yf.8jR./6tX0vI.N6.8X.8X.8X.8X.');

-- SET FOREIGN_KEY_CHECKS = 1;