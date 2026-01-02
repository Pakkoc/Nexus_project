import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { LeftMemberRepositoryPort, LeftMember } from '@topia/core';
import { Result } from '@topia/core';

interface LeftMemberRow extends RowDataPacket {
  guild_id: string;
  user_id: string;
  left_at: Date;
  expires_at: Date;
  created_at: Date;
}

function toLeftMember(row: LeftMemberRow): LeftMember {
  return {
    guildId: row.guild_id,
    userId: row.user_id,
    leftAt: row.left_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export class LeftMemberRepository implements LeftMemberRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async save(member: LeftMember): Promise<Result<void, Error>> {
    try {
      await this.pool.execute(
        `INSERT INTO left_members (guild_id, user_id, left_at, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         left_at = VALUES(left_at),
         expires_at = VALUES(expires_at)`,
        [member.guildId, member.userId, member.leftAt, member.expiresAt, member.createdAt]
      );

      return Result.ok(undefined);
    } catch (error) {
      return Result.err(error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  async delete(guildId: string, userId: string): Promise<Result<void, Error>> {
    try {
      await this.pool.execute(
        'DELETE FROM left_members WHERE guild_id = ? AND user_id = ?',
        [guildId, userId]
      );

      return Result.ok(undefined);
    } catch (error) {
      return Result.err(error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  async findExpired(): Promise<Result<LeftMember[], Error>> {
    try {
      const [rows] = await this.pool.execute<LeftMemberRow[]>(
        'SELECT * FROM left_members WHERE expires_at <= NOW()'
      );

      return Result.ok(rows.map(toLeftMember));
    } catch (error) {
      return Result.err(error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  async findByGuildId(guildId: string): Promise<Result<LeftMember[], Error>> {
    try {
      const [rows] = await this.pool.execute<LeftMemberRow[]>(
        'SELECT * FROM left_members WHERE guild_id = ? ORDER BY left_at DESC',
        [guildId]
      );

      return Result.ok(rows.map(toLeftMember));
    } catch (error) {
      return Result.err(error instanceof Error ? error : new Error('Unknown error'));
    }
  }
}
