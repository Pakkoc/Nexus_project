-- 상점 아이템 테이블
CREATE TABLE shop_items (
    id INT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price BIGINT NOT NULL,
    currency_type ENUM('topy', 'ruby') NOT NULL,
    item_type ENUM('role', 'color', 'premium_room', 'random_box', 'warning_remove', 'tax_exempt', 'custom') NOT NULL,
    duration_days INT NULL,
    role_id VARCHAR(20) NULL,
    stock INT NULL,
    max_per_user INT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_guild (guild_id),
    INDEX idx_enabled (guild_id, enabled),
    CONSTRAINT fk_shop_items_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
