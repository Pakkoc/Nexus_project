/**
 * 상점 색상 옵션
 * 색상변경권 아이템에 대한 색상-역할 매핑
 */
export interface ColorOption {
  id: number;
  itemId: number;       // shop_items.id 참조
  color: string;        // HEX 색상 (#FF0000)
  name: string;         // 색상 이름 (빨강)
  roleId: string;       // Discord 역할 ID
  createdAt: Date;
}

/**
 * 색상 옵션 생성용 타입
 */
export type CreateColorOption = Omit<ColorOption, 'id' | 'createdAt'>;

/**
 * 색상 옵션 생성
 */
export function createColorOption(
  itemId: number,
  color: string,
  name: string,
  roleId: string
): CreateColorOption {
  return {
    itemId,
    color: color.toUpperCase(),
    name,
    roleId,
  };
}
