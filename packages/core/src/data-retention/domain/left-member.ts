/**
 * 서버를 탈퇴한 멤버 정보
 */
export interface LeftMember {
  guildId: string;
  userId: string;
  leftAt: Date;
  expiresAt: Date; // 데이터 만료 시각 (leftAt + retentionDays)
  createdAt: Date;
}

export function createLeftMember(
  guildId: string,
  userId: string,
  retentionDays: number
): LeftMember {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);

  return {
    guildId,
    userId,
    leftAt: now,
    expiresAt,
    createdAt: now,
  };
}
