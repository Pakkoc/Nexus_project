-- 화폐 핫타임에 channel_ids 컬럼 추가
-- 핫타임이 적용될 특정 채널 ID 목록 (JSON 배열). NULL이면 모든 채널에 적용
ALTER TABLE currency_hot_times
ADD COLUMN channel_ids JSON DEFAULT NULL AFTER enabled;
