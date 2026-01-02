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
  rank1Percent: number | null; // 카테고리별 순위 비율 (null=전역설정)
  rank2Percent: number | null;
  rank3Percent: number | null;
  rank4Percent: number | null;
  winnerTakesAll: boolean; // 2팀 승자독식
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
  rank1Percent?: number | null;
  rank2Percent?: number | null;
  rank3Percent?: number | null;
  rank4Percent?: number | null;
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
  rank1Percent?: number | null;
  rank2Percent?: number | null;
  rank3Percent?: number | null;
  rank4Percent?: number | null;
  winnerTakesAll?: boolean;
}
