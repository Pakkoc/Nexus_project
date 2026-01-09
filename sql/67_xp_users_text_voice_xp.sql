-- xp_users 테이블에 텍스트 XP, 음성 XP 컬럼 추가
-- 평균 텍스트 XP, 평균 음성 XP 통계를 위함

ALTER TABLE xp_users
ADD COLUMN text_xp INT NOT NULL DEFAULT 0 AFTER xp,
ADD COLUMN voice_xp INT NOT NULL DEFAULT 0 AFTER text_xp;

-- 인덱스 추가 (통계 조회 최적화)
ALTER TABLE xp_users
ADD INDEX idx_xp_users_text_xp (guild_id, text_xp),
ADD INDEX idx_xp_users_voice_xp (guild_id, voice_xp);
