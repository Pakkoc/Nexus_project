/**
 * 상점 아이템 타입
 */
export type ItemType =
  | 'role'           // 역할 부여
  | 'color'          // 색상 변경권
  | 'premium_room'   // 프리미엄 잠수방
  | 'random_box'     // 랜덤박스
  | 'warning_remove' // 경고 차감
  | 'tax_exempt'     // 세금 면제권
  | 'custom';        // 커스텀

/**
 * 상점 아이템
 */
export interface ShopItem {
  id: number;
  guildId: string;
  name: string;
  description: string | null;
  price: bigint;
  currencyType: 'topy' | 'ruby';
  itemType: ItemType;
  durationDays: number | null;  // 기간제 아이템의 유효 기간
  roleId: string | null;        // 역할 부여 아이템의 역할 ID
  stock: number | null;         // 재고 (null = 무제한)
  maxPerUser: number | null;    // 유저당 최대 구매 횟수 (null = 무제한)
  enabled: boolean;
  createdAt: Date;
}

/**
 * 상점 아이템 생성
 */
export function createShopItem(
  guildId: string,
  name: string,
  price: bigint,
  currencyType: 'topy' | 'ruby',
  itemType: ItemType,
  options?: {
    description?: string;
    durationDays?: number;
    roleId?: string;
    stock?: number;
    maxPerUser?: number;
  }
): Omit<ShopItem, 'id' | 'createdAt'> {
  return {
    guildId,
    name,
    description: options?.description ?? null,
    price,
    currencyType,
    itemType,
    durationDays: options?.durationDays ?? null,
    roleId: options?.roleId ?? null,
    stock: options?.stock ?? null,
    maxPerUser: options?.maxPerUser ?? null,
    enabled: true,
  };
}
