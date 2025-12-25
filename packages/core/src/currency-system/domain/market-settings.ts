/**
 * 장터 설정 엔티티
 * 서버당 하나의 패널만 설치 가능
 */
export interface MarketSettings {
  guildId: string;
  channelId: string | null;
  messageId: string | null;
  topyFeePercent: number;
  rubyFeePercent: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 장터 설정 생성 DTO
 */
export interface CreateMarketSettingsDto {
  guildId: string;
  channelId?: string;
  messageId?: string;
  topyFeePercent?: number;
  rubyFeePercent?: number;
}

/**
 * 장터 설정 업데이트 DTO
 */
export interface UpdateMarketSettingsDto {
  channelId?: string | null;
  messageId?: string | null;
  topyFeePercent?: number;
  rubyFeePercent?: number;
}

/**
 * 기본 수수료
 */
export const DEFAULT_TOPY_FEE_PERCENT = 5;
export const DEFAULT_RUBY_FEE_PERCENT = 3;
