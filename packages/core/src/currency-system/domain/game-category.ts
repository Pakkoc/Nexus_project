/**
 * 순위별 보상 비율 타입
 * 키: 순위 (1, 2, 3, ...)
 * 값: 보상 비율 (%)
 */
export type RankRewards = Record<number, number>;

/**
 * 내전 카테고리 엔티티
 */
export interface GameCategory {
  id: number;
  guildId: string;
  name: string;
  teamCount: number;
  enabled: boolean;
  maxPlayersPerTeam: number | null; // 팀당 최대 인원 (null=제한없음)
  rankRewards: RankRewards | null; // 순위별 보상 비율 (null=전역설정)
  winnerTakesAll: boolean; // 승자독식 (1등 100%)
  createdAt: Date;
}

/**
 * 카테고리 생성 DTO
 */
export interface CreateCategoryDto {
  guildId: string;
  name: string;
  teamCount: number;
  maxPlayersPerTeam?: number | null;
  rankRewards?: RankRewards | null;
  winnerTakesAll?: boolean;
}

/**
 * 카테고리 업데이트 DTO
 */
export interface UpdateCategoryDto {
  name?: string;
  teamCount?: number;
  enabled?: boolean;
  maxPlayersPerTeam?: number | null;
  rankRewards?: RankRewards | null;
  winnerTakesAll?: boolean;
}
