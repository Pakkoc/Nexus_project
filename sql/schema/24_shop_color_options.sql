-- 상점 색상 옵션 테이블
-- 색상변경권 아이템에 대한 색상-역할 매핑
CREATE TABLE IF NOT EXISTS shop_color_options (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_id INT NOT NULL,                    -- shop_items.id 참조
  color VARCHAR(7) NOT NULL,               -- HEX 색상 (#FF0000)
  name VARCHAR(50) NOT NULL,               -- 색상 이름 (빨강)
  role_id VARCHAR(20) NOT NULL,            -- Discord 역할 ID
  price BIGINT NOT NULL DEFAULT 0,         -- 색상별 가격 (0이면 아이템 기본 가격 사용)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (item_id) REFERENCES shop_items(id) ON DELETE CASCADE,
  UNIQUE KEY unique_item_color (item_id, color),
  INDEX idx_item_id (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
