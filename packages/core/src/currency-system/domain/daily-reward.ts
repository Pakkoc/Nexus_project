/**
 * 일일 보상 타입
 */
export type RewardType = 'attendance' | 'subscription';

/**
 * 일일 보상 엔티티
 */
export interface DailyReward {
  guildId: string;
  userId: string;
  rewardType: RewardType;
  lastClaimedAt: Date;
  streakCount: number;
  totalCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 새 일일 보상 레코드 생성
 */
export function createDailyReward(
  guildId: string,
  userId: string,
  rewardType: RewardType,
  now: Date
): DailyReward {
  return {
    guildId,
    userId,
    rewardType,
    lastClaimedAt: now,
    streakCount: 1,
    totalCount: 1,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 24시간 쿨다운 확인
 */
export function canClaimReward(
  lastClaimedAt: Date | null,
  now: Date
): { canClaim: boolean; remainingMs: number } {
  if (!lastClaimedAt) {
    return { canClaim: true, remainingMs: 0 };
  }

  const cooldownMs = 24 * 60 * 60 * 1000; // 24시간
  const elapsedMs = now.getTime() - lastClaimedAt.getTime();
  const remainingMs = Math.max(0, cooldownMs - elapsedMs);

  return {
    canClaim: remainingMs === 0,
    remainingMs,
  };
}

/**
 * 연속 출석 계산 (24~48시간 내: streak+1, 그 외: streak=1)
 */
export function calculateStreak(
  lastClaimedAt: Date | null,
  currentStreak: number,
  now: Date
): number {
  if (!lastClaimedAt) {
    return 1;
  }

  const elapsedMs = now.getTime() - lastClaimedAt.getTime();
  const hours = elapsedMs / (60 * 60 * 1000);

  // 24~48시간 내 출석: 연속 유지
  if (hours >= 24 && hours < 48) {
    return currentStreak + 1;
  }

  // 48시간 이상 경과: 연속 초기화
  return 1;
}

/**
 * 다음 출석 가능 시간 계산
 */
export function getNextClaimTime(lastClaimedAt: Date): Date {
  const cooldownMs = 24 * 60 * 60 * 1000;
  return new Date(lastClaimedAt.getTime() + cooldownMs);
}
