import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { DailyRewardRepositoryPort, DailyReward, RewardType, RepositoryError } from '@topia/core';
import { Result } from '@topia/core';

interface DailyRewardRow extends RowDataPacket {
  guild_id: string;
  user_id: string;
  reward_type: 'attendance' | 'subscription';
  last_claimed_at: Date;
  streak_count: number;
  total_count: number;
  created_at: Date;
  updated_at: Date;
}

function toDailyReward(row: DailyRewardRow): DailyReward {
  return {
    guildId: row.guild_id,
    userId: row.user_id,
    rewardType: row.reward_type,
    lastClaimedAt: row.last_claimed_at,
    streakCount: row.streak_count,
    totalCount: row.total_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class DailyRewardRepository implements DailyRewardRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async findByUser(
    guildId: string,
    userId: string,
    rewardType: RewardType
  ): Promise<Result<DailyReward | null, RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<DailyRewardRow[]>(
        'SELECT * FROM daily_rewards WHERE guild_id = ? AND user_id = ? AND reward_type = ?',
        [guildId, userId, rewardType]
      );

      const firstRow = rows[0];
      if (!firstRow) {
        return Result.ok(null);
      }

      return Result.ok(toDailyReward(firstRow));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async save(reward: DailyReward): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.execute(
        `INSERT INTO daily_rewards
         (guild_id, user_id, reward_type, last_claimed_at, streak_count, total_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         last_claimed_at = VALUES(last_claimed_at),
         streak_count = VALUES(streak_count),
         total_count = VALUES(total_count),
         updated_at = VALUES(updated_at)`,
        [
          reward.guildId,
          reward.userId,
          reward.rewardType,
          reward.lastClaimedAt,
          reward.streakCount,
          reward.totalCount,
          reward.createdAt,
          reward.updatedAt,
        ]
      );

      return Result.ok(undefined);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async findAllByUser(
    guildId: string,
    userId: string
  ): Promise<Result<DailyReward[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<DailyRewardRow[]>(
        'SELECT * FROM daily_rewards WHERE guild_id = ? AND user_id = ?',
        [guildId, userId]
      );

      return Result.ok(rows.map(toDailyReward));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getTodayClaimCount(
    guildId: string,
    rewardType: RewardType
  ): Promise<Result<number, RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<(RowDataPacket & { count: number })[]>(
        `SELECT COUNT(*) as count FROM daily_rewards
         WHERE guild_id = ? AND reward_type = ? AND DATE(last_claimed_at) = CURDATE()`,
        [guildId, rewardType]
      );

      const count = rows[0]?.count ?? 0;
      return Result.ok(count);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
