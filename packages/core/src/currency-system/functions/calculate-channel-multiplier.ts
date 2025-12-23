import { CURRENCY_DEFAULTS } from '@topia/shared';
import type { ChannelCategory } from '../domain/channel-category';
import type { CategoryMultipliers } from '../domain/category-multiplier';

/**
 * 채널 카테고리에 따른 기본 배율 반환
 */
export function getChannelCategoryMultiplier(category: ChannelCategory): number {
  return CURRENCY_DEFAULTS.CHANNEL_CATEGORY_MULTIPLIERS[category];
}

/**
 * 서버별 커스텀 배율을 적용한 카테고리 배율 반환
 * @param category 채널 카테고리
 * @param customMultiplier 서버의 커스텀 배율 (없으면 null/undefined)
 */
export function getChannelCategoryMultiplierWithCustom(
  category: ChannelCategory,
  customMultiplier: number | null | undefined
): number {
  // 커스텀 설정이 있으면 사용, 없으면 기본값
  return customMultiplier ?? CURRENCY_DEFAULTS.CHANNEL_CATEGORY_MULTIPLIERS[category];
}

/**
 * 기본 배율값 맵 반환
 */
export function getDefaultCategoryMultipliers(): CategoryMultipliers {
  return { ...CURRENCY_DEFAULTS.CHANNEL_CATEGORY_MULTIPLIERS };
}
