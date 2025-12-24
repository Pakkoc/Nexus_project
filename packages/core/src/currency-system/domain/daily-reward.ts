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
 * 날짜를 자정(00:00:00)으로 변환
 */
function getDateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * 하루에 한 번 출석 가능 여부 확인 (자정 기준 리셋)
 */
export function canClaimReward(
  lastClaimedAt: Date | null,
  now: Date
): { canClaim: boolean; alreadyClaimedToday: boolean } {
  if (!lastClaimedAt) {
    return { canClaim: true, alreadyClaimedToday: false };
  }

  const lastClaimDate = getDateOnly(lastClaimedAt);
  const todayDate = getDateOnly(now);

  // 오늘 이미 출석했으면 불가
  const alreadyClaimedToday = lastClaimDate.getTime() === todayDate.getTime();

  return {
    canClaim: !alreadyClaimedToday,
    alreadyClaimedToday,
  };
}

/**
 * 연속 출석 계산 (어제 출석했으면 streak+1, 그 외 streak=1)
 */
export function calculateStreak(
  lastClaimedAt: Date | null,
  currentStreak: number,
  now: Date
): number {
  if (!lastClaimedAt) {
    return 1;
  }

  const lastClaimDate = getDateOnly(lastClaimedAt);
  const todayDate = getDateOnly(now);

  // 어제 날짜 계산
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);

  // 어제 출석했으면 연속 유지
  if (lastClaimDate.getTime() === yesterdayDate.getTime()) {
    return currentStreak + 1;
  }

  // 그 외 (이틀 이상 경과): 연속 초기화
  return 1;
}

/**
 * 다음 출석 가능 시간 계산 (다음날 자정)
 */
export function getNextClaimTime(now: Date): Date {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return tomorrow;
}
