import type { ClockPort } from '../../shared/port/clock.port';
import type { ShopRepositoryPort } from '../port/shop-repository.port';
import type { TopyWalletRepositoryPort } from '../port/topy-wallet-repository.port';
import type { RubyWalletRepositoryPort } from '../port/ruby-wallet-repository.port';
import type { CurrencyTransactionRepositoryPort } from '../port/currency-transaction-repository.port';
import type { ShopItem, ItemType } from '../domain/shop-item';
import type { UserItem } from '../domain/user-item';
import type { PurchaseHistory } from '../domain/purchase-history';
import type { CurrencyError } from '../errors';
import { Result } from '../../shared/types/result';
import { createTransaction } from '../domain/currency-transaction';
import { createTopyWallet } from '../domain/topy-wallet';

export interface PurchaseResult {
  item: ShopItem;
  price: bigint;
  fee: bigint;
  newBalance: bigint;
}

export interface UseItemResult {
  itemType: string;
  remainingQuantity: number;
}

export class ShopService {
  constructor(
    private readonly shopRepo: ShopRepositoryPort,
    private readonly topyWalletRepo: TopyWalletRepositoryPort,
    private readonly rubyWalletRepo: RubyWalletRepositoryPort,
    private readonly transactionRepo: CurrencyTransactionRepositoryPort,
    private readonly clock: ClockPort
  ) {}

  /**
   * 상점 아이템 목록 조회
   */
  async getShopItems(
    guildId: string,
    enabledOnly: boolean = true
  ): Promise<Result<ShopItem[], CurrencyError>> {
    const result = await this.shopRepo.findItems(guildId, { enabledOnly });
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(result.data);
  }

  /**
   * 상점 아이템 단일 조회
   */
  async getShopItem(itemId: number): Promise<Result<ShopItem | null, CurrencyError>> {
    const result = await this.shopRepo.findItemById(itemId);
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(result.data);
  }

  /**
   * 상점 아이템 생성 (관리자)
   */
  async createShopItem(
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
  ): Promise<Result<ShopItem, CurrencyError>> {
    const item = {
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

    const result = await this.shopRepo.saveItem(item);
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(result.data);
  }

  /**
   * 상점 아이템 수정 (관리자)
   */
  async updateShopItem(
    itemId: number,
    updates: Partial<Omit<ShopItem, 'id' | 'guildId' | 'createdAt'>>
  ): Promise<Result<void, CurrencyError>> {
    const result = await this.shopRepo.updateItem(itemId, updates);
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(undefined);
  }

  /**
   * 상점 아이템 삭제 (관리자)
   */
  async deleteShopItem(itemId: number): Promise<Result<void, CurrencyError>> {
    const result = await this.shopRepo.deleteItem(itemId);
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(undefined);
  }

  /**
   * 아이템 구매
   */
  async purchaseItem(
    guildId: string,
    userId: string,
    itemId: number
  ): Promise<Result<PurchaseResult, CurrencyError>> {
    const now = this.clock.now();

    // 1. 아이템 조회
    const itemResult = await this.shopRepo.findItemById(itemId);
    if (!itemResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: itemResult.error });
    }
    if (!itemResult.data) {
      return Result.err({ type: 'ITEM_NOT_FOUND' });
    }

    const item = itemResult.data;

    // 2. 아이템 유효성 검사
    if (!item.enabled) {
      return Result.err({ type: 'ITEM_DISABLED' });
    }
    if (item.guildId !== guildId) {
      return Result.err({ type: 'ITEM_NOT_FOUND' });
    }

    // 3. 재고 확인
    if (item.stock !== null && item.stock <= 0) {
      return Result.err({ type: 'OUT_OF_STOCK' });
    }

    // 4. 유저당 구매 제한 확인
    if (item.maxPerUser !== null) {
      const countResult = await this.shopRepo.getUserPurchaseCount(guildId, userId, itemId);
      if (!countResult.success) {
        return Result.err({ type: 'REPOSITORY_ERROR', cause: countResult.error });
      }
      if (countResult.data >= item.maxPerUser) {
        return Result.err({
          type: 'PURCHASE_LIMIT_EXCEEDED',
          maxPerUser: item.maxPerUser,
          currentCount: countResult.data,
        });
      }
    }

    // 5. 수수료 계산 (TODO: 디토뱅크 등급에 따라 면제)
    const feePercent = 1.2; // 기본 1.2%
    const fee = (item.price * BigInt(Math.round(feePercent * 10))) / BigInt(1000);
    const totalCost = item.price + fee;

    // 6. 잔액 확인 및 차감
    let newBalance: bigint;

    if (item.currencyType === 'topy') {
      const walletResult = await this.topyWalletRepo.findByUser(guildId, userId);
      if (!walletResult.success) {
        return Result.err({ type: 'REPOSITORY_ERROR', cause: walletResult.error });
      }

      const wallet = walletResult.data ?? createTopyWallet(guildId, userId, now);
      if (wallet.balance < totalCost) {
        return Result.err({
          type: 'INSUFFICIENT_BALANCE',
          required: totalCost,
          available: wallet.balance,
        });
      }

      const subtractResult = await this.topyWalletRepo.updateBalance(
        guildId,
        userId,
        totalCost,
        'subtract'
      );
      if (!subtractResult.success) {
        return Result.err({ type: 'REPOSITORY_ERROR', cause: subtractResult.error });
      }
      newBalance = subtractResult.data.balance;
    } else {
      const walletResult = await this.rubyWalletRepo.findByUser(guildId, userId);
      if (!walletResult.success) {
        return Result.err({ type: 'REPOSITORY_ERROR', cause: walletResult.error });
      }

      if (!walletResult.data || walletResult.data.balance < totalCost) {
        return Result.err({
          type: 'INSUFFICIENT_BALANCE',
          required: totalCost,
          available: walletResult.data?.balance ?? BigInt(0),
        });
      }

      const subtractResult = await this.rubyWalletRepo.updateBalance(
        guildId,
        userId,
        totalCost,
        'subtract'
      );
      if (!subtractResult.success) {
        return Result.err({ type: 'REPOSITORY_ERROR', cause: subtractResult.error });
      }
      newBalance = subtractResult.data.balance;
    }

    // 7. 재고 감소
    if (item.stock !== null) {
      await this.shopRepo.decreaseStock(itemId);
    }

    // 8. 유저 아이템 지급
    const expiresAt = item.durationDays
      ? new Date(now.getTime() + item.durationDays * 24 * 60 * 60 * 1000)
      : null;

    await this.shopRepo.increaseUserItemQuantity(
      guildId,
      userId,
      item.itemType,
      1,
      expiresAt
    );

    // 9. 구매 내역 저장
    await this.shopRepo.savePurchaseHistory({
      guildId,
      userId,
      itemId,
      itemName: item.name,
      price: item.price,
      fee,
      currencyType: item.currencyType,
      purchasedAt: now,
    });

    // 10. 거래 기록 저장
    await this.transactionRepo.save(
      createTransaction(
        guildId,
        userId,
        item.currencyType,
        'shop_purchase',
        item.price,
        newBalance + fee,
        { description: `상점 구매: ${item.name}` }
      )
    );

    if (fee > BigInt(0)) {
      await this.transactionRepo.save(
        createTransaction(
          guildId,
          userId,
          item.currencyType,
          'fee',
          fee,
          newBalance,
          { description: '구매 수수료' }
        )
      );
    }

    return Result.ok({
      item,
      price: item.price,
      fee,
      newBalance,
    });
  }

  /**
   * 유저 보유 아이템 목록 조회
   */
  async getUserItems(
    guildId: string,
    userId: string
  ): Promise<Result<UserItem[], CurrencyError>> {
    const result = await this.shopRepo.findUserItems(guildId, userId);
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(result.data);
  }

  /**
   * 아이템 사용
   */
  async useItem(
    guildId: string,
    userId: string,
    itemType: string
  ): Promise<Result<UseItemResult, CurrencyError>> {
    const now = this.clock.now();

    // 1. 유저 아이템 조회
    const itemResult = await this.shopRepo.findUserItem(guildId, userId, itemType);
    if (!itemResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: itemResult.error });
    }
    if (!itemResult.data || itemResult.data.quantity <= 0) {
      return Result.err({ type: 'ITEM_NOT_OWNED' });
    }

    const userItem = itemResult.data;

    // 2. 만료 확인
    if (userItem.expiresAt && userItem.expiresAt < now) {
      return Result.err({ type: 'ITEM_EXPIRED' });
    }

    // 3. 수량 감소
    await this.shopRepo.decreaseUserItemQuantity(guildId, userId, itemType, 1);

    return Result.ok({
      itemType,
      remainingQuantity: userItem.quantity - 1,
    });
  }

  /**
   * 구매 내역 조회
   */
  async getPurchaseHistory(
    guildId: string,
    userId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Result<PurchaseHistory[], CurrencyError>> {
    const result = await this.shopRepo.findPurchaseHistory(guildId, userId, options);
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(result.data);
  }
}
