import type { CurrencyType } from '../../currency-system/domain/currency-transaction';

/**
 * 국고 거래 유형
 */
export type TreasuryTransactionType =
  | 'transfer_fee'      // 이체 수수료
  | 'shop_fee'          // 상점 수수료
  | 'tax'               // 월말 세금
  | 'admin_distribute'; // 관리자 지급 (이벤트)

/**
 * 국고 거래 내역
 */
export interface TreasuryTransaction {
  id: bigint;
  guildId: string;
  currencyType: CurrencyType;
  transactionType: TreasuryTransactionType;
  amount: bigint;
  balanceAfter: bigint;
  relatedUserId: string | null;
  description: string | null;
  createdAt: Date;
}

export function createTreasuryTransaction(
  guildId: string,
  currencyType: CurrencyType,
  transactionType: TreasuryTransactionType,
  amount: bigint,
  balanceAfter: bigint,
  relatedUserId?: string,
  description?: string
): Omit<TreasuryTransaction, 'id' | 'createdAt'> {
  return {
    guildId,
    currencyType,
    transactionType,
    amount,
    balanceAfter,
    relatedUserId: relatedUserId ?? null,
    description: description ?? null,
  };
}
