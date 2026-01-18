import type { Result } from '../../shared/types/result';
import type { GuildTreasury } from '../domain/treasury';
import type { TreasuryTransaction, TreasuryTransactionType } from '../domain/treasury-transaction';
import type { CurrencyType } from '../../currency-system/domain/currency-transaction';

export interface TreasuryRepositoryPort {
  /**
   * 국고 조회 (없으면 생성)
   */
  findOrCreate(guildId: string): Promise<Result<GuildTreasury, Error>>;

  /**
   * 국고 잔액 추가 (수수료/세금 적립)
   */
  addBalance(
    guildId: string,
    currencyType: CurrencyType,
    amount: bigint
  ): Promise<Result<GuildTreasury, Error>>;

  /**
   * 국고 잔액 차감 (이벤트 지급)
   */
  subtractBalance(
    guildId: string,
    currencyType: CurrencyType,
    amount: bigint
  ): Promise<Result<GuildTreasury, Error>>;

  /**
   * 국고 거래 내역 저장
   */
  saveTransaction(
    transaction: Omit<TreasuryTransaction, 'id' | 'createdAt'>
  ): Promise<Result<TreasuryTransaction, Error>>;

  /**
   * 국고 거래 내역 조회 (페이지네이션)
   */
  findTransactions(
    guildId: string,
    options?: {
      transactionType?: TreasuryTransactionType;
      limit?: number;
      offset?: number;
    }
  ): Promise<Result<{ transactions: TreasuryTransaction[]; total: number }, Error>>;

  /**
   * 이번 달 수집량 조회
   */
  getMonthlyCollected(
    guildId: string
  ): Promise<Result<{ topy: bigint; ruby: bigint }, Error>>;
}
