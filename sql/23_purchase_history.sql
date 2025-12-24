-- 구매 내역 테이블
CREATE TABLE purchase_history (
    id BIGINT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    item_id INT NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    price BIGINT NOT NULL,
    fee BIGINT NOT NULL DEFAULT 0,
    currency_type ENUM('topy', 'ruby') NOT NULL,
    purchased_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_user (guild_id, user_id),
    INDEX idx_item (item_id),
    CONSTRAINT fk_purchase_history_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
