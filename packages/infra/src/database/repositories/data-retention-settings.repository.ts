import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { DataRetentionSettingsRepositoryPort, DataRetentionSettings } from '@topia/core';
import { Result } from '@topia/core';

interface DataRetentionSettingsRow extends RowDataPacket {
  guild_id: string;
  retention_days: number;
  created_at: Date;
  updated_at: Date;
}

function toDataRetentionSettings(row: DataRetentionSettingsRow): DataRetentionSettings {
  return {
    guildId: row.guild_id,
    retentionDays: row.retention_days,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class DataRetentionSettingsRepository implements DataRetentionSettingsRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async findByGuildId(guildId: string): Promise<Result<DataRetentionSettings | null, Error>> {
    try {
      const [rows] = await this.pool.execute<DataRetentionSettingsRow[]>(
        'SELECT * FROM data_retention_settings WHERE guild_id = ?',
        [guildId]
      );

      const firstRow = rows[0];
      if (!firstRow) {
        return Result.ok(null);
      }

      return Result.ok(toDataRetentionSettings(firstRow));
    } catch (error) {
      return Result.err(error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  async save(settings: DataRetentionSettings): Promise<Result<void, Error>> {
    try {
      await this.pool.execute(
        `INSERT INTO data_retention_settings (guild_id, retention_days, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         retention_days = VALUES(retention_days),
         updated_at = VALUES(updated_at)`,
        [settings.guildId, settings.retentionDays, settings.createdAt, settings.updatedAt]
      );

      return Result.ok(undefined);
    } catch (error) {
      return Result.err(error instanceof Error ? error : new Error('Unknown error'));
    }
  }
}
