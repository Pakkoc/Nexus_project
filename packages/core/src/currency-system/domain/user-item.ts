/**
 * 유저 보유 아이템
 */
export interface UserItem {
  id: number;
  guildId: string;
  userId: string;
  itemType: string;
  quantity: number;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 유저 아이템 생성/업데이트
 */
export function createUserItem(
  guildId: string,
  userId: string,
  itemType: string,
  quantity: number,
  expiresAt: Date | null,
  now: Date
): Omit<UserItem, 'id'> {
  return {
    guildId,
    userId,
    itemType,
    quantity,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 아이템 만료 여부 확인
 */
export function isItemExpired(item: UserItem, now: Date): boolean {
  if (!item.expiresAt) {
    return false;
  }
  return item.expiresAt < now;
}

/**
 * 유효한 아이템인지 확인 (수량 > 0 && 만료되지 않음)
 */
export function isValidItem(item: UserItem, now: Date): boolean {
  return item.quantity > 0 && !isItemExpired(item, now);
}
