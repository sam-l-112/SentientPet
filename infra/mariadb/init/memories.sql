-- 新增 memories 表以支援長期記憶功能
CREATE TABLE memories (
    mem_id      INT             NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id     INT             NOT NULL,
    content     TEXT            NOT NULL,
    type        VARCHAR(50)     NOT NULL,  -- 例如: preference, personal, issue, goal
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_user_id (user_id),

    CONSTRAINT fk_mem_user
        FOREIGN KEY (user_id) REFERENCES users (user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;