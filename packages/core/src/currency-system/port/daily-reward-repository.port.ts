import type { Result } from '../../shared/types/result';
import type { DailyReward, RewardType } from '../domain/daily-reward';
import type { RepositoryError } from '../errors';

export interface DailyRewardRepositoryPort {
  /**
   * 유저의 특정 타입 보상 조회
   */
  findByUser(
    guildId: string,
    userId: string,
    rewardType: RewardType
  ): Promise<Result<DailyReward | null, RepositoryError>>;

  /**
   * 보상 저장 (upsert)
   */
  save(reward: DailyReward): Promise<Result<void, RepositoryError>>;

  /**
   * 유저의 모든 보상 조회
   */
  findAllByUser(
    guildId: string,
    userId: string
  ): Promise<Result<DailyReward[], RepositoryError>>;

  /**
   * 길드의 오늘 출석한 유저 수 조회
   */
  getTodayClaimCount(
    guildId: string,
    rewardType: RewardType
  ): Promise<Result<number, RepositoryError>>;
}
