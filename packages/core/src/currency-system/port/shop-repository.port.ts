import type { Result } from '../../shared/types/result';
import type { ShopItem, ItemType } from '../domain/shop-item';
import type { UserItem } from '../domain/user-item';
import type { PurchaseHistory } from '../domain/purchase-history';
import type { RepositoryError } from '../errors';

export interface ShopRepositoryPort {
  // ========== Shop Items ==========

  /**
   * 상점 아이템 목록 조회
   */
  findItems(
    guildId: string,
    options?: { enabledOnly?: boolean }
  ): Promise<Result<ShopItem[], RepositoryError>>;

  /**
   * 상점 아이템 단일 조회
   */
  findItemById(itemId: number): Promise<Result<ShopItem | null, RepositoryError>>;

  /**
   * 상점 아이템 저장
   */
  saveItem(item: Omit<ShopItem, 'id' | 'createdAt'>): Promise<Result<ShopItem, RepositoryError>>;

  /**
   * 상점 아이템 업데이트
   */
  updateItem(
    itemId: number,
    updates: Partial<Omit<ShopItem, 'id' | 'guildId' | 'createdAt'>>
  ): Promise<Result<void, RepositoryError>>;

  /**
   * 상점 아이템 삭제
   */
  deleteItem(itemId: number): Promise<Result<void, RepositoryError>>;

  /**
   * 재고 감소
   */
  decreaseStock(itemId: number): Promise<Result<void, RepositoryError>>;

  // ========== User Items ==========

  /**
   * 유저 보유 아이템 목록 조회
   */
  findUserItems(
    guildId: string,
    userId: string
  ): Promise<Result<UserItem[], RepositoryError>>;

  /**
   * 유저의 특정 타입 아이템 조회
   */
  findUserItem(
    guildId: string,
    userId: string,
    itemType: string
  ): Promise<Result<UserItem | null, RepositoryError>>;

  /**
   * 유저 아이템 저장/업데이트 (upsert)
   */
  upsertUserItem(
    guildId: string,
    userId: string,
    itemType: string,
    quantity: number,
    expiresAt: Date | null
  ): Promise<Result<void, RepositoryError>>;

  /**
   * 유저 아이템 수량 증가
   */
  increaseUserItemQuantity(
    guildId: string,
    userId: string,
    itemType: string,
    amount: number,
    expiresAt: Date | null
  ): Promise<Result<void, RepositoryError>>;

  /**
   * 유저 아이템 수량 감소
   */
  decreaseUserItemQuantity(
    guildId: string,
    userId: string,
    itemType: string,
    amount: number
  ): Promise<Result<void, RepositoryError>>;

  // ========== Purchase History ==========

  /**
   * 구매 내역 저장
   */
  savePurchaseHistory(
    history: Omit<PurchaseHistory, 'id'>
  ): Promise<Result<void, RepositoryError>>;

  /**
   * 유저 구매 내역 조회
   */
  findPurchaseHistory(
    guildId: string,
    userId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Result<PurchaseHistory[], RepositoryError>>;

  /**
   * 특정 아이템에 대한 유저 구매 횟수 조회
   */
  getUserPurchaseCount(
    guildId: string,
    userId: string,
    itemId: number
  ): Promise<Result<number, RepositoryError>>;
}
