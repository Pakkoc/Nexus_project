-- 일일 보상 (출석, 구독 등)
CREATE TABLE daily_rewards (
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    reward_type ENUM('attendance', 'subscription') NOT NULL,
    last_claimed_at DATETIME NOT NULL,
    streak_count INT NOT NULL DEFAULT 0,
    total_count INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (guild_id, user_id, reward_type),
    INDEX idx_daily_rewards_guild (guild_id),
    INDEX idx_daily_rewards_user (guild_id, user_id),
    CONSTRAINT fk_daily_rewards_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
