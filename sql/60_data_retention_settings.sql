-- 서버별 데이터 보존 기간 설정
CREATE TABLE IF NOT EXISTS data_retention_settings (
    guild_id VARCHAR(20) NOT NULL,
    retention_days INT NOT NULL DEFAULT 3,  -- 기본 3일
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (guild_id),
    CONSTRAINT fk_data_retention_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
