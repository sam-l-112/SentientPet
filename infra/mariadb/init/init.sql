-- 建立資料庫 (如果 docker-compose 沒建立的話)
CREATE DATABASE IF NOT EXISTS sentient_pet CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sentient_pet;

-- 建立使用者資料表 (範例)
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 建立 AI 寵物狀態表 (針對你的專案特性)
CREATE TABLE IF NOT EXISTS `pet_stats` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT,
  `pet_name` VARCHAR(50),
  `mood_score` INT DEFAULT 100,
  `last_interaction` DATETIME,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 插入一筆開發測試用資料 (選配)
INSERT INTO `users` (username, password_hash) VALUES ('admin', 'hashed_password_here');