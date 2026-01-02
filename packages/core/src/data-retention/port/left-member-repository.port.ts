import type { Result } from '../../shared/types/result';
import type { LeftMember } from '../domain/left-member';

export interface LeftMemberRepositoryPort {
  /**
   * 탈퇴 멤버 기록 추가 (재입장 시 기존 기록 덮어쓰기)
   */
  save(member: LeftMember): Promise<Result<void, Error>>;

  /**
   * 탈퇴 멤버 기록 삭제 (재입장 시 호출)
   */
  delete(guildId: string, userId: string): Promise<Result<void, Error>>;

  /**
   * 만료된 탈퇴 멤버 목록 조회 (expires_at <= now)
   */
  findExpired(): Promise<Result<LeftMember[], Error>>;

  /**
   * 특정 서버의 탈퇴 멤버 조회
   */
  findByGuildId(guildId: string): Promise<Result<LeftMember[], Error>>;
}
