import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type {
  CurrencyManagerRepositoryPort,
  CurrencyManager,
  CreateCurrencyManagerInput,
  CurrencyType,
} from '@topia/core';
import { Result } from '@topia/core';
import type { RepositoryError } from '@topia/core';

interface CurrencyManagerRow extends RowDataPacket {
  id: number;
  guild_id: string;
  user_id: string;
  currency_type: CurrencyType;
  created_at: Date;
}

function rowToCurrencyManager(row: CurrencyManagerRow): CurrencyManager {
  return {
    id: row.id,
    guildId: row.guild_id,
    userId: row.user_id,
    currencyType: row.currency_type,
    createdAt: row.created_at,
  };
}

export class CurrencyManagerRepository implements CurrencyManagerRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async findByGuild(guildId: string, currencyType?: CurrencyType): Promise<Result<CurrencyManager[], RepositoryError>> {
    try {
      let query = 'SELECT * FROM currency_managers WHERE guild_id = ?';
      const params: string[] = [guildId];

      if (currencyType) {
        query += ' AND currency_type = ?';
        params.push(currencyType);
      }

      query += ' ORDER BY created_at ASC';

      const [rows] = await this.pool.query<CurrencyManagerRow[]>(query, params);
      return Result.ok(rows.map(rowToCurrencyManager));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async isManager(guildId: string, userId: string, currencyType: CurrencyType): Promise<Result<boolean, RepositoryError>> {
    try {
      const [rows] = await this.pool.query<CurrencyManagerRow[]>(
        'SELECT id FROM currency_managers WHERE guild_id = ? AND user_id = ? AND currency_type = ? LIMIT 1',
        [guildId, userId, currencyType]
      );
      return Result.ok(rows.length > 0);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async add(input: CreateCurrencyManagerInput): Promise<Result<CurrencyManager, RepositoryError>> {
    try {
      const [result] = await this.pool.execute<ResultSetHeader>(
        'INSERT INTO currency_managers (guild_id, user_id, currency_type) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id = id',
        [input.guildId, input.userId, input.currencyType]
      );

      // 새로 추가된 경우 insertId 사용, 이미 존재하는 경우 조회
      if (result.insertId) {
        const [rows] = await this.pool.query<CurrencyManagerRow[]>(
          'SELECT * FROM currency_managers WHERE id = ?',
          [result.insertId]
        );
        if (rows.length > 0) {
          return Result.ok(rowToCurrencyManager(rows[0]!));
        }
      }

      // 이미 존재하는 경우 조회
      const [rows] = await this.pool.query<CurrencyManagerRow[]>(
        'SELECT * FROM currency_managers WHERE guild_id = ? AND user_id = ? AND currency_type = ?',
        [input.guildId, input.userId, input.currencyType]
      );
      if (rows.length > 0) {
        return Result.ok(rowToCurrencyManager(rows[0]!));
      }

      return Result.err({
        type: 'NOT_FOUND',
        message: 'Failed to add currency manager',
      });
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async remove(guildId: string, userId: string, currencyType: CurrencyType): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.execute(
        'DELETE FROM currency_managers WHERE guild_id = ? AND user_id = ? AND currency_type = ?',
        [guildId, userId, currencyType]
      );
      return Result.ok(undefined);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
