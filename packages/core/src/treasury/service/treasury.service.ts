import type { Result } from '../../shared/types/result';
import type { TreasuryRepositoryPort } from '../port/treasury-repository.port';
import type { GuildTreasury } from '../domain/treasury';
import type { TreasuryTransaction, TreasuryTransactionType } from '../domain/treasury-transaction';
import type { TreasuryError } from '../errors';
import type { CurrencyType } from '../../currency-system/domain/currency-transaction';
import { createTreasuryTransaction } from '../domain/treasury-transaction';

export interface TreasuryService {
  /**
   * 국고 조회
   */
  getTreasury(guildId: string): Promise<Result<GuildTreasury, TreasuryError>>;

  /**
   * 이번 달 수집량 조회
   */
  getMonthlyCollected(guildId: string): Promise<Result<{ topy: bigint; ruby: bigint }, TreasuryError>>;

  /**
   * 국고에 적립 (수수료/세금)
   */
  deposit(
    guildId: string,
    currencyType: CurrencyType,
    amount: bigint,
    transactionType: 'transfer_fee' | 'shop_fee' | 'tax',
    relatedUserId?: string,
    description?: string
  ): Promise<Result<GuildTreasury, TreasuryError>>;

  /**
   * 국고에서 지급 (관리자 이벤트)
   */
  distribute(
    guildId: string,
    currencyType: CurrencyType,
    amount: bigint,
    toUserId: string,
    description?: string
  ): Promise<Result<{ treasury: GuildTreasury; transaction: TreasuryTransaction }, TreasuryError>>;

  /**
   * 국고 거래 내역 조회
   */
  getTransactions(
    guildId: string,
    options?: {
      transactionType?: TreasuryTransactionType;
      limit?: number;
      offset?: number;
    }
  ): Promise<Result<{ transactions: TreasuryTransaction[]; total: number }, TreasuryError>>;
}

export function createTreasuryService(
  treasuryRepo: TreasuryRepositoryPort
): TreasuryService {
  return {
    async getTreasury(guildId) {
      const result = await treasuryRepo.findOrCreate(guildId);
      if (!result.success) {
        return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
      }
      return { success: true, data: result.data };
    },

    async getMonthlyCollected(guildId) {
      const result = await treasuryRepo.getMonthlyCollected(guildId);
      if (!result.success) {
        return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
      }
      return { success: true, data: result.data };
    },

    async deposit(guildId, currencyType, amount, transactionType, relatedUserId, description) {
      if (amount <= BigInt(0)) {
        return { success: false, error: { type: 'INVALID_AMOUNT', message: '금액은 0보다 커야 합니다.' } };
      }

      // 1. 국고 잔액 추가
      const addResult = await treasuryRepo.addBalance(guildId, currencyType, amount);
      if (!addResult.success) {
        return { success: false, error: { type: 'REPOSITORY_ERROR', cause: addResult.error } };
      }

      // 2. 거래 내역 저장
      const balanceAfter = currencyType === 'topy'
        ? addResult.data.topyBalance
        : addResult.data.rubyBalance;

      const transaction = createTreasuryTransaction(
        guildId,
        currencyType,
        transactionType,
        amount,
        balanceAfter,
        relatedUserId,
        description
      );

      await treasuryRepo.saveTransaction(transaction);

      return { success: true, data: addResult.data };
    },

    async distribute(guildId, currencyType, amount, toUserId, description) {
      if (amount <= BigInt(0)) {
        return { success: false, error: { type: 'INVALID_AMOUNT', message: '금액은 0보다 커야 합니다.' } };
      }

      // 1. 현재 국고 조회
      const treasuryResult = await treasuryRepo.findOrCreate(guildId);
      if (!treasuryResult.success) {
        return { success: false, error: { type: 'REPOSITORY_ERROR', cause: treasuryResult.error } };
      }

      // 2. 잔액 확인
      const currentBalance = currencyType === 'topy'
        ? treasuryResult.data.topyBalance
        : treasuryResult.data.rubyBalance;

      if (currentBalance < amount) {
        return {
          success: false,
          error: { type: 'INSUFFICIENT_BALANCE', required: amount, available: currentBalance },
        };
      }

      // 3. 국고 잔액 차감
      const subtractResult = await treasuryRepo.subtractBalance(guildId, currencyType, amount);
      if (!subtractResult.success) {
        return { success: false, error: { type: 'REPOSITORY_ERROR', cause: subtractResult.error } };
      }

      // 4. 거래 내역 저장
      const balanceAfter = currencyType === 'topy'
        ? subtractResult.data.topyBalance
        : subtractResult.data.rubyBalance;

      const transaction = createTreasuryTransaction(
        guildId,
        currencyType,
        'admin_distribute',
        amount,
        balanceAfter,
        toUserId,
        description
      );

      const txResult = await treasuryRepo.saveTransaction(transaction);
      if (!txResult.success) {
        return { success: false, error: { type: 'REPOSITORY_ERROR', cause: txResult.error } };
      }

      return {
        success: true,
        data: {
          treasury: subtractResult.data,
          transaction: txResult.data,
        },
      };
    },

    async getTransactions(guildId, options) {
      const result = await treasuryRepo.findTransactions(guildId, options);
      if (!result.success) {
        return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
      }
      return { success: true, data: result.data };
    },
  };
}
