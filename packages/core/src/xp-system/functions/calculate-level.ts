import { LEVEL_FORMULA } from '@topia/shared';
import type { LevelRequirementsMap } from '../domain/xp-level-requirements';

/**
 * XP로 레벨 계산 (기본 공식)
 * 공식: level = floor(sqrt(xp / 100))
 */
export function calculateLevel(xp: number): number {
  if (xp < 0) return 0;
  return Math.floor(Math.sqrt(xp / LEVEL_FORMULA.MULTIPLIER));
}

/**
 * 특정 레벨에 필요한 총 XP 계산 (기본 공식)
 * 공식: xp = level^2 * 100
 */
export function calculateXpForLevel(level: number): number {
  if (level < 0) return 0;
  return level * level * LEVEL_FORMULA.MULTIPLIER;
}

/**
 * 커스텀 요구사항으로 XP에서 레벨 계산
 * 커스텀 설정이 없으면 기본 공식 사용
 */
export function calculateLevelWithCustom(
  xp: number,
  requirements: LevelRequirementsMap
): number {
  if (xp < 0) return 0;
  if (requirements.size === 0) {
    return calculateLevel(xp);
  }

  // 레벨을 오름차순으로 정렬
  const sortedLevels = Array.from(requirements.entries())
    .sort((a, b) => a[0] - b[0]);

  let currentLevel = 0;
  for (const [level, requiredXp] of sortedLevels) {
    if (xp >= requiredXp) {
      currentLevel = level;
    } else {
      break;
    }
  }

  return currentLevel;
}

/**
 * 커스텀 요구사항으로 특정 레벨에 필요한 XP 계산
 * 커스텀 설정이 없으면 기본 공식 사용
 */
export function calculateXpForLevelWithCustom(
  level: number,
  requirements: LevelRequirementsMap
): number {
  if (level < 0) return 0;
  if (requirements.size === 0) {
    return calculateXpForLevel(level);
  }

  return requirements.get(level) ?? calculateXpForLevel(level);
}
