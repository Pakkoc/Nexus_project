-- 동적 순위 보상 시스템으로 변경
-- rank1~4_percent 고정 컬럼 → rank_rewards JSON

-- 1. game_categories 테이블 변경
ALTER TABLE game_categories
  DROP COLUMN rank1_percent,
  DROP COLUMN rank2_percent,
  DROP COLUMN rank3_percent,
  DROP COLUMN rank4_percent,
  ADD COLUMN rank_rewards JSON NULL COMMENT '순위별 보상 비율 (예: {"1": 50, "2": 30, "3": 15, "4": 5})';

-- 2. game_settings 테이블 변경 (전역 기본값)
ALTER TABLE game_settings
  DROP COLUMN rank1_percent,
  DROP COLUMN rank2_percent,
  DROP COLUMN rank3_percent,
  DROP COLUMN rank4_percent,
  ADD COLUMN rank_rewards JSON NULL COMMENT '순위별 보상 비율 기본값';

-- 3. 기본값 설정 (기존 데이터 호환)
UPDATE game_settings
SET rank_rewards = '{"1": 50, "2": 30, "3": 15, "4": 5}'
WHERE rank_rewards IS NULL;
