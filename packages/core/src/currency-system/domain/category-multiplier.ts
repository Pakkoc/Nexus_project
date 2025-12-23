import type { ChannelCategory } from './channel-category';

/**
 * 서버별 채널 카테고리 배율 설정
 */
export interface CategoryMultiplierConfig {
  id: number;
  guildId: string;
  category: ChannelCategory;
  multiplier: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 4개 카테고리의 배율 맵
 */
export type CategoryMultipliers = Record<ChannelCategory, number>;
