import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type {
  MarketSettingsRepositoryPort,
  MarketSettings,
  CreateMarketSettingsDto,
  UpdateMarketSettingsDto,
} from '@topia/core';

interface MarketSettingsRow extends RowDataPacket {
  guild_id: string;
  channel_id: string | null;
  message_id: string | null;
  topy_fee_percent: number;
  ruby_fee_percent: number;
  created_at: Date;
  updated_at: Date;
}

function rowToEntity(row: MarketSettingsRow): MarketSettings {
  return {
    guildId: row.guild_id,
    channelId: row.channel_id,
    messageId: row.message_id,
    topyFeePercent: row.topy_fee_percent,
    rubyFeePercent: row.ruby_fee_percent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class MarketSettingsRepository implements MarketSettingsRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async findByGuildId(guildId: string): Promise<MarketSettings | null> {
    const [rows] = await this.pool.query<MarketSettingsRow[]>(
      `SELECT * FROM market_settings WHERE guild_id = ?`,
      [guildId]
    );

    if (rows.length === 0) {
      return null;
    }

    return rowToEntity(rows[0]!);
  }

  async upsert(dto: CreateMarketSettingsDto): Promise<MarketSettings> {
    await this.pool.query<ResultSetHeader>(
      `INSERT INTO market_settings (guild_id, channel_id, message_id, topy_fee_percent, ruby_fee_percent)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         channel_id = COALESCE(VALUES(channel_id), channel_id),
         message_id = COALESCE(VALUES(message_id), message_id),
         topy_fee_percent = COALESCE(VALUES(topy_fee_percent), topy_fee_percent),
         ruby_fee_percent = COALESCE(VALUES(ruby_fee_percent), ruby_fee_percent),
         updated_at = CURRENT_TIMESTAMP`,
      [
        dto.guildId,
        dto.channelId ?? null,
        dto.messageId ?? null,
        dto.topyFeePercent ?? 5,
        dto.rubyFeePercent ?? 3,
      ]
    );

    const result = await this.findByGuildId(dto.guildId);
    return result!;
  }

  async update(
    guildId: string,
    dto: UpdateMarketSettingsDto
  ): Promise<MarketSettings | null> {
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (dto.channelId !== undefined) {
      updates.push('channel_id = ?');
      values.push(dto.channelId);
    }
    if (dto.messageId !== undefined) {
      updates.push('message_id = ?');
      values.push(dto.messageId);
    }
    if (dto.topyFeePercent !== undefined) {
      updates.push('topy_fee_percent = ?');
      values.push(dto.topyFeePercent);
    }
    if (dto.rubyFeePercent !== undefined) {
      updates.push('ruby_fee_percent = ?');
      values.push(dto.rubyFeePercent);
    }

    if (updates.length === 0) {
      return this.findByGuildId(guildId);
    }

    values.push(guildId);

    await this.pool.query<ResultSetHeader>(
      `UPDATE market_settings SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ?`,
      values
    );

    return this.findByGuildId(guildId);
  }

  async updatePanel(
    guildId: string,
    channelId: string | null,
    messageId: string | null
  ): Promise<void> {
    // 먼저 설정이 있는지 확인
    const existing = await this.findByGuildId(guildId);

    if (existing) {
      await this.pool.query<ResultSetHeader>(
        `UPDATE market_settings SET channel_id = ?, message_id = ?, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ?`,
        [channelId, messageId, guildId]
      );
    } else {
      // 없으면 기본값으로 생성
      await this.pool.query<ResultSetHeader>(
        `INSERT INTO market_settings (guild_id, channel_id, message_id) VALUES (?, ?, ?)`,
        [guildId, channelId, messageId]
      );
    }
  }
}
