import type { Result } from '../../shared/types/result';
import type { DataRetentionSettings } from '../domain/data-retention-settings';

export interface DataRetentionSettingsRepositoryPort {
  /**
   * 서버의 데이터 보존 설정 조회
   */
  findByGuildId(guildId: string): Promise<Result<DataRetentionSettings | null, Error>>;

  /**
   * 데이터 보존 설정 저장 (upsert)
   */
  save(settings: DataRetentionSettings): Promise<Result<void, Error>>;
}
