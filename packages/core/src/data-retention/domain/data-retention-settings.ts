/**
 * 서버별 데이터 보존 기간 설정
 */
export interface DataRetentionSettings {
  guildId: string;
  retentionDays: number; // 탈퇴 후 데이터 보존 기간 (일)
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_RETENTION_DAYS = 3;

export function createDefaultDataRetentionSettings(guildId: string): DataRetentionSettings {
  const now = new Date();
  return {
    guildId,
    retentionDays: DEFAULT_RETENTION_DAYS,
    createdAt: now,
    updatedAt: now,
  };
}
