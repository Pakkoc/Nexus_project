import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { Result } from '@topia/core';
import type {
  TreasuryRepositoryPort,
  GuildTreasury,
  TreasuryTransaction,
  TreasuryTransactionType,
  CurrencyType,
} from '@topia/core';

interface TreasuryRow extends RowDataPacket {
  guild_id: string;
  topy_balance: bigint;
  ruby_balance: bigint;
  total_topy_collected: bigint;
  total_ruby_collected: bigint;
  total_topy_distributed: bigint;
  total_ruby_distributed: bigint;
  created_at: Date;
  updated_at: Date;
}

interface TreasuryTransactionRow extends RowDataPacket {
  id: bigint;
  guild_id: string;
  currency_type: 'topy' | 'ruby';
  transaction_type: TreasuryTransactionType;
  amount: bigint;
  balance_after: bigint;
  related_user_id: string | null;
  description: string | null;
  created_at: Date;
}

interface CountRow extends RowDataPacket {
  total: number;
}

interface SumRow extends RowDataPacket {
  topy_sum: bigint | null;
  ruby_sum: bigint | null;
}

function rowToTreasury(row: TreasuryRow): GuildTreasury {
  return {
    guildId: row.guild_id,
    topyBalance: BigInt(row.topy_balance),
    rubyBalance: BigInt(row.ruby_balance),
    totalTopyCollected: BigInt(row.total_topy_collected),
    totalRubyCollected: BigInt(row.total_ruby_collected),
    totalTopyDistributed: BigInt(row.total_topy_distributed),
    totalRubyDistributed: BigInt(row.total_ruby_distributed),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToTransaction(row: TreasuryTransactionRow): TreasuryTransaction {
  return {
    id: BigInt(row.id),
    guildId: row.guild_id,
    currencyType: row.currency_type,
    transactionType: row.transaction_type,
    amount: BigInt(row.amount),
    balanceAfter: BigInt(row.balance_after),
    relatedUserId: row.related_user_id,
    description: row.description,
    createdAt: row.created_at,
  };
}

export class TreasuryRepository implements TreasuryRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async findOrCreate(guildId: string): Promise<Result<GuildTreasury, Error>> {
    try {
      // 먼저 기존 국고 확인
      const [existingRows] = await this.pool.query<TreasuryRow[]>(
        `SELECT * FROM guild_treasury WHERE guild_id = ?`,
        [guildId]
      );

      if (existingRows.length > 0) {
        return { success: true, data: rowToTreasury(existingRows[0]!) };
      }

      // 없으면 생성
      await this.pool.query<ResultSetHeader>(
        `INSERT INTO guild_treasury (guild_id) VALUES (?)`,
        [guildId]
      );

      const [rows] = await this.pool.query<TreasuryRow[]>(
        `SELECT * FROM guild_treasury WHERE guild_id = ?`,
        [guildId]
      );

      return { success: true, data: rowToTreasury(rows[0]!) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  async addBalance(
    guildId: string,
    currencyType: CurrencyType,
    amount: bigint
  ): Promise<Result<GuildTreasury, Error>> {
    try {
      // 국고가 없으면 생성
      await this.findOrCreate(guildId);

      const balanceColumn = currencyType === 'topy' ? 'topy_balance' : 'ruby_balance';
      const collectedColumn = currencyType === 'topy' ? 'total_topy_collected' : 'total_ruby_collected';

      await this.pool.query<ResultSetHeader>(
        `UPDATE guild_treasury
         SET ${balanceColumn} = ${balanceColumn} + ?,
             ${collectedColumn} = ${collectedColumn} + ?
         WHERE guild_id = ?`,
        [amount, amount, guildId]
      );

      const [rows] = await this.pool.query<TreasuryRow[]>(
        `SELECT * FROM guild_treasury WHERE guild_id = ?`,
        [guildId]
      );

      return { success: true, data: rowToTreasury(rows[0]!) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  async subtractBalance(
    guildId: string,
    currencyType: CurrencyType,
    amount: bigint
  ): Promise<Result<GuildTreasury, Error>> {
    try {
      const balanceColumn = currencyType === 'topy' ? 'topy_balance' : 'ruby_balance';
      const distributedColumn = currencyType === 'topy' ? 'total_topy_distributed' : 'total_ruby_distributed';

      await this.pool.query<ResultSetHeader>(
        `UPDATE guild_treasury
         SET ${balanceColumn} = ${balanceColumn} - ?,
             ${distributedColumn} = ${distributedColumn} + ?
         WHERE guild_id = ?`,
        [amount, amount, guildId]
      );

      const [rows] = await this.pool.query<TreasuryRow[]>(
        `SELECT * FROM guild_treasury WHERE guild_id = ?`,
        [guildId]
      );

      return { success: true, data: rowToTreasury(rows[0]!) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  async saveTransaction(
    transaction: Omit<TreasuryTransaction, 'id' | 'createdAt'>
  ): Promise<Result<TreasuryTransaction, Error>> {
    try {
      const [result] = await this.pool.query<ResultSetHeader>(
        `INSERT INTO treasury_transactions
         (guild_id, currency_type, transaction_type, amount, balance_after, related_user_id, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          transaction.guildId,
          transaction.currencyType,
          transaction.transactionType,
          transaction.amount,
          transaction.balanceAfter,
          transaction.relatedUserId,
          transaction.description,
        ]
      );

      const [rows] = await this.pool.query<TreasuryTransactionRow[]>(
        `SELECT * FROM treasury_transactions WHERE id = ?`,
        [result.insertId]
      );

      return { success: true, data: rowToTransaction(rows[0]!) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  async findTransactions(
    guildId: string,
    options?: {
      transactionType?: TreasuryTransactionType;
      limit?: number;
      offset?: number;
    }
  ): Promise<Result<{ transactions: TreasuryTransaction[]; total: number }, Error>> {
    try {
      const limit = options?.limit ?? 20;
      const offset = options?.offset ?? 0;

      let whereClause = 'WHERE guild_id = ?';
      const params: (string | number)[] = [guildId];

      if (options?.transactionType) {
        whereClause += ' AND transaction_type = ?';
        params.push(options.transactionType);
      }

      // 총 개수 조회
      const [countRows] = await this.pool.query<CountRow[]>(
        `SELECT COUNT(*) as total FROM treasury_transactions ${whereClause}`,
        params
      );
      const total = countRows[0]?.total ?? 0;

      // 거래 내역 조회
      const [rows] = await this.pool.query<TreasuryTransactionRow[]>(
        `SELECT * FROM treasury_transactions ${whereClause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      return {
        success: true,
        data: {
          transactions: rows.map(rowToTransaction),
          total,
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  async getMonthlyCollected(
    guildId: string
  ): Promise<Result<{ topy: bigint; ruby: bigint }, Error>> {
    try {
      const [rows] = await this.pool.query<SumRow[]>(
        `SELECT
           COALESCE(SUM(CASE WHEN currency_type = 'topy' THEN amount ELSE 0 END), 0) as topy_sum,
           COALESCE(SUM(CASE WHEN currency_type = 'ruby' THEN amount ELSE 0 END), 0) as ruby_sum
         FROM treasury_transactions
         WHERE guild_id = ?
           AND transaction_type IN ('transfer_fee', 'shop_fee', 'tax')
           AND YEAR(created_at) = YEAR(NOW())
           AND MONTH(created_at) = MONTH(NOW())`,
        [guildId]
      );

      return {
        success: true,
        data: {
          topy: BigInt(rows[0]?.topy_sum ?? 0),
          ruby: BigInt(rows[0]?.ruby_sum ?? 0),
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
}
