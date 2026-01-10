-- 화폐 관리자 테이블에 currency_type 추가
-- 'topy': 토피(활동형 화폐) 관리자
-- 'ruby': 루비(유료 화폐) 관리자

-- 기존 유니크 키 삭제
ALTER TABLE currency_managers DROP INDEX uk_guild_user;

-- currency_type 컬럼 추가 (기존 데이터는 'topy'로 설정)
ALTER TABLE currency_managers
ADD COLUMN currency_type ENUM('topy', 'ruby') NOT NULL DEFAULT 'topy' AFTER user_id;

-- 새로운 유니크 키 추가 (guild_id, user_id, currency_type)
ALTER TABLE currency_managers
ADD UNIQUE KEY uk_guild_user_type (guild_id, user_id, currency_type);
