-- 내전 카테고리에 순위 보상 비율 및 팀당 최대 인원 추가
ALTER TABLE game_categories
  ADD COLUMN max_players_per_team INT NULL DEFAULT NULL COMMENT '팀당 최대 인원 (NULL=제한없음)',
  ADD COLUMN rank1_percent INT NULL DEFAULT NULL COMMENT '1등 보상 비율 (NULL=전역설정 사용)',
  ADD COLUMN rank2_percent INT NULL DEFAULT NULL COMMENT '2등 보상 비율',
  ADD COLUMN rank3_percent INT NULL DEFAULT NULL COMMENT '3등 보상 비율',
  ADD COLUMN rank4_percent INT NULL DEFAULT NULL COMMENT '4등 보상 비율',
  ADD COLUMN winner_takes_all TINYINT(1) NOT NULL DEFAULT 0 COMMENT '2팀 게임 승자독식 여부';

-- 게임에 팀당 최대 인원 저장 (카테고리에서 복사)
ALTER TABLE games
  ADD COLUMN max_players_per_team INT NULL DEFAULT NULL COMMENT '팀당 최대 인원';
