-- 화폐 관리자 기능 활성화 설정 추가
-- topy_manager_enabled: 토피(활동형 화폐) 관리자 기능 활성화
-- ruby_manager_enabled: 루비(유료 화폐) 관리자 기능 활성화

ALTER TABLE currency_settings
ADD COLUMN topy_manager_enabled BOOLEAN NOT NULL DEFAULT TRUE AFTER ruby_name,
ADD COLUMN ruby_manager_enabled BOOLEAN NOT NULL DEFAULT TRUE AFTER topy_manager_enabled;
