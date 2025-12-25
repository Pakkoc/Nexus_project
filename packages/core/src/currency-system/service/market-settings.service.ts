import type { MarketSettingsRepositoryPort } from '../port/market-settings-repository.port';
import type {
  MarketSettings,
  UpdateMarketSettingsDto,
} from '../domain/market-settings';
import {
  DEFAULT_TOPY_FEE_PERCENT,
  DEFAULT_RUBY_FEE_PERCENT,
} from '../domain/market-settings';
import type { CurrencyError } from '../errors';
import { Result } from '../../shared/types/result';

export class MarketSettingsService {
  constructor(
    private readonly marketSettingsRepo: MarketSettingsRepositoryPort
  ) {}

  /**
   * 길드의 장터 설정 조회
   * 설정이 없으면 기본값 반환
   */
  async getSettings(guildId: string): Promise<Result<MarketSettings, CurrencyError>> {
    const result = await this.marketSettingsRepo.findByGuildId(guildId);

    if (result) {
      return Result.ok(result);
    }

    // 기본 설정 반환
    return Result.ok({
      guildId,
      channelId: null,
      messageId: null,
      topyFeePercent: DEFAULT_TOPY_FEE_PERCENT,
      rubyFeePercent: DEFAULT_RUBY_FEE_PERCENT,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * 수수료율 조회
   */
  async getFeePercent(
    guildId: string,
    currencyType: 'topy' | 'ruby'
  ): Promise<number> {
    const result = await this.marketSettingsRepo.findByGuildId(guildId);

    if (result) {
      return currencyType === 'topy'
        ? result.topyFeePercent
        : result.rubyFeePercent;
    }

    return currencyType === 'topy'
      ? DEFAULT_TOPY_FEE_PERCENT
      : DEFAULT_RUBY_FEE_PERCENT;
  }

  /**
   * 장터 설정 저장 (upsert)
   */
  async saveSettings(
    guildId: string,
    dto: UpdateMarketSettingsDto
  ): Promise<Result<MarketSettings, CurrencyError>> {
    try {
      const result = await this.marketSettingsRepo.upsert({
        guildId,
        channelId: dto.channelId ?? undefined,
        messageId: dto.messageId ?? undefined,
        topyFeePercent: dto.topyFeePercent,
        rubyFeePercent: dto.rubyFeePercent,
      });

      return Result.ok(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err({
        type: 'REPOSITORY_ERROR',
        cause: { type: 'QUERY_ERROR', message },
      });
    }
  }

  /**
   * 패널 정보 업데이트
   */
  async updatePanel(
    guildId: string,
    channelId: string | null,
    messageId: string | null
  ): Promise<Result<void, CurrencyError>> {
    try {
      await this.marketSettingsRepo.updatePanel(guildId, channelId, messageId);
      return Result.ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err({
        type: 'REPOSITORY_ERROR',
        cause: { type: 'QUERY_ERROR', message },
      });
    }
  }
}
