-- 서버를 탈퇴한 멤버 추적 (데이터 보존 기간 후 삭제)
CREATE TABLE IF NOT EXISTS left_members (
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    left_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,  -- 데이터 만료 시각 (left_at + retention_days)
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (guild_id, user_id),
    CONSTRAINT fk_left_members_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
    INDEX idx_left_members_expires (expires_at)  -- 만료된 데이터 조회용 인덱스
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
