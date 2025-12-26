/**
 * 상점 아이템 - 티켓 판매
 */
export interface ShopItem {
  id: number;
  guildId: string;
  name: string;
  description: string | null;
  price: bigint;
  currencyType: 'topy' | 'ruby';
  durationDays: number; // 0=영구, 양수=기간제
  stock: number | null; // null=무제한
  maxPerUser: number | null; // null=무제한
  enabled: boolean;
  createdAt: Date;
}

export interface CreateShopItemInput {
  guildId: string;
  name: string;
  description?: string | null;
  price: bigint;
  currencyType: 'topy' | 'ruby';
  durationDays?: number;
  stock?: number | null;
  maxPerUser?: number | null;
  enabled?: boolean;
}

export interface UpdateShopItemInput {
  name?: string;
  description?: string | null;
  price?: bigint;
  currencyType?: 'topy' | 'ruby';
  durationDays?: number;
  stock?: number | null;
  maxPerUser?: number | null;
  enabled?: boolean;
}

/**
 * 기간제 아이템인지 확인
 */
export function isPeriodItem(item: ShopItem): boolean {
  return item.durationDays > 0;
}

// Backward compatibility aliases
export type ShopItemV2 = ShopItem;
export type CreateShopItemV2Input = CreateShopItemInput;
export type UpdateShopItemV2Input = UpdateShopItemInput;
