/**
 * 구매 내역
 */
export interface PurchaseHistory {
  id: number;
  guildId: string;
  userId: string;
  itemId: number;
  itemName: string;
  price: bigint;
  fee: bigint;
  currencyType: 'topy' | 'ruby';
  purchasedAt: Date;
}

/**
 * 구매 내역 생성
 */
export function createPurchaseHistory(
  guildId: string,
  userId: string,
  itemId: number,
  itemName: string,
  price: bigint,
  fee: bigint,
  currencyType: 'topy' | 'ruby',
  now: Date
): Omit<PurchaseHistory, 'id'> {
  return {
    guildId,
    userId,
    itemId,
    itemName,
    price,
    fee,
    currencyType,
    purchasedAt: now,
  };
}
