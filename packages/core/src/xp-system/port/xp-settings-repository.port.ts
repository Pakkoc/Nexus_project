import type { Result } from '../../shared/types/result';
import type { XpSettings } from '../domain/xp-settings';
import type { LevelRequirement } from '../domain/xp-level-requirements';
import type { RepositoryError } from '../errors';
import type { HotTimeConfig } from '../functions/check-hot-time';

export interface LevelReward {
  id: number;
  guildId: string;
  level: number;
  roleId: string;
  removeOnHigherLevel: boolean;
}

export interface LevelChannel {
  id: number;
  guildId: string;
  level: number;
  channelId: string;
}

export interface XpSettingsRepositoryPort {
  findByGuild(guildId: string): Promise<Result<XpSettings | null, RepositoryError>>;
  save(settings: XpSettings): Promise<Result<void, RepositoryError>>;
  getExcludedChannels(guildId: string): Promise<Result<string[], RepositoryError>>;
  getExcludedRoles(guildId: string): Promise<Result<string[], RepositoryError>>;
  getHotTimes(guildId: string, type: 'text' | 'voice' | 'all'): Promise<Result<HotTimeConfig[], RepositoryError>>;
  getLevelRewards(guildId: string): Promise<Result<LevelReward[], RepositoryError>>;
  getLevelChannels(guildId: string): Promise<Result<LevelChannel[], RepositoryError>>;

  // 레벨 요구사항
  getLevelRequirements(guildId: string): Promise<Result<LevelRequirement[], RepositoryError>>;
  saveLevelRequirement(guildId: string, level: number, requiredXp: number): Promise<Result<void, RepositoryError>>;
  deleteLevelRequirement(guildId: string, level: number): Promise<Result<void, RepositoryError>>;
  deleteAllLevelRequirements(guildId: string): Promise<Result<void, RepositoryError>>;
}
