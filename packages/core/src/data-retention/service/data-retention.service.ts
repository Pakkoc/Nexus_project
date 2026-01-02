import { Result } from '../../shared/types/result';
import {
  type DataRetentionSettings,
  DEFAULT_RETENTION_DAYS,
  createDefaultDataRetentionSettings,
} from '../domain/data-retention-settings';
import { createLeftMember, type LeftMember } from '../domain/left-member';
import type { DataRetentionSettingsRepositoryPort } from '../port/data-retention-settings-repository.port';
import type { LeftMemberRepositoryPort } from '../port/left-member-repository.port';

export interface UserDataCleanupPort {
  /**
   * 유저의 모든 데이터 삭제 (XP, 화폐, 인벤토리, 거래 기록 등)
   */
  deleteUserData(guildId: string, userId: string): Promise<Result<void, Error>>;
}

export class DataRetentionService {
  constructor(
    private readonly settingsRepo: DataRetentionSettingsRepositoryPort,
    private readonly leftMemberRepo: LeftMemberRepositoryPort,
    private readonly userDataCleanup: UserDataCleanupPort
  ) {}

  /**
   * 데이터 보존 설정 조회
   */
  async getSettings(guildId: string): Promise<Result<DataRetentionSettings, Error>> {
    const result = await this.settingsRepo.findByGuildId(guildId);

    if (!result.success) {
      return result;
    }

    // 설정이 없으면 기본값 반환
    if (!result.data) {
      return Result.ok(createDefaultDataRetentionSettings(guildId));
    }

    return Result.ok(result.data);
  }

  /**
   * 데이터 보존 기간 설정 저장
   */
  async saveSettings(guildId: string, retentionDays: number): Promise<Result<void, Error>> {
    const settings: DataRetentionSettings = {
      guildId,
      retentionDays,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.settingsRepo.save(settings);
  }

  /**
   * 멤버 탈퇴 처리 - 탈퇴 기록 추가
   */
  async handleMemberLeave(guildId: string, userId: string): Promise<Result<void, Error>> {
    // 보존 기간 조회
    const settingsResult = await this.getSettings(guildId);
    const retentionDays = settingsResult.success
      ? settingsResult.data.retentionDays
      : DEFAULT_RETENTION_DAYS;

    // 탈퇴 기록 추가
    const leftMember = createLeftMember(guildId, userId, retentionDays);
    return this.leftMemberRepo.save(leftMember);
  }

  /**
   * 멤버 재입장 처리 - 탈퇴 기록 삭제 (데이터 보존)
   */
  async handleMemberJoin(guildId: string, userId: string): Promise<Result<void, Error>> {
    return this.leftMemberRepo.delete(guildId, userId);
  }

  /**
   * 만료된 멤버 데이터 정리 (스케줄러에서 호출)
   */
  async cleanupExpiredData(): Promise<Result<{ cleaned: number }, Error>> {
    const expiredResult = await this.leftMemberRepo.findExpired();

    if (!expiredResult.success) {
      return expiredResult;
    }

    let cleaned = 0;

    for (const member of expiredResult.data) {
      // 유저 데이터 삭제
      const deleteResult = await this.userDataCleanup.deleteUserData(
        member.guildId,
        member.userId
      );

      if (deleteResult.success) {
        // 탈퇴 기록도 삭제
        await this.leftMemberRepo.delete(member.guildId, member.userId);
        cleaned++;
      }
    }

    return Result.ok({ cleaned });
  }

  /**
   * 특정 서버의 탈퇴 멤버 목록 조회
   */
  async getLeftMembers(guildId: string): Promise<Result<LeftMember[], Error>> {
    return this.leftMemberRepo.findByGuildId(guildId);
  }
}
