-- 디토뱅크 구독 테이블
-- 같은 티어 구매 시 연장, 다른 티어 구매 시 현재 만료 후 적용
CREATE TABLE IF NOT EXISTS bank_subscriptions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    tier ENUM('silver', 'gold') NOT NULL,
    starts_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_guild_user (guild_id, user_id),
    INDEX idx_expires (expires_at),
    INDEX idx_active (guild_id, user_id, starts_at, expires_at),
    CONSTRAINT fk_bank_subscriptions_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
