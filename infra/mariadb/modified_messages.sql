-- 修改後的 messages 表格，添加 role 字段
CREATE TABLE messages (
    user_id    INT           NOT NULL,
    chat_session_time_date TIMESTAMP NOT NULL,
    
    role       ENUM('user', 'assistant') NOT NULL,  -- 新增：區分訊息來源
    content    TEXT          NOT NULL,
    message_time_date TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (user_id,chat_session_time_date,message_time_date),

    CONSTRAINT fk_mes_session
        FOREIGN KEY (user_id, chat_session_time_date) REFERENCES chat_sessions(user_id, chat_session_time_date)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
