import type {
  MarketSettings,
  CreateMarketSettingsDto,
  UpdateMarketSettingsDto,
} from '../domain/market-settings';

/**
 * 장터 설정 레포지토리 포트
 */
export interface MarketSettingsRepositoryPort {
  /**
   * 길드의 장터 설정 조회
   */
  findByGuildId(guildId: string): Promise<MarketSettings | null>;

  /**
   * 장터 설정 생성 또는 업데이트 (upsert)
   */
  upsert(dto: CreateMarketSettingsDto): Promise<MarketSettings>;

  /**
   * 장터 설정 업데이트
   */
  update(guildId: string, dto: UpdateMarketSettingsDto): Promise<MarketSettings | null>;

  /**
   * 패널 정보 업데이트 (채널, 메시지 ID)
   */
  updatePanel(
    guildId: string,
    channelId: string | null,
    messageId: string | null
  ): Promise<void>;
}
