-- 레벨별 필요 XP 커스텀 설정 테이블
CREATE TABLE IF NOT EXISTS xp_level_requirements (
    guild_id VARCHAR(20) NOT NULL,
    level INT NOT NULL,
    required_xp INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (guild_id, level),
    CONSTRAINT fk_level_req_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,

    INDEX idx_level_req_guild (guild_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
