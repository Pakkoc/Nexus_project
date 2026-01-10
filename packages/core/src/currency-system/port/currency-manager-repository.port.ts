import type { Result } from '../../shared/types/result';
import type { CurrencyManager, CreateCurrencyManagerInput } from '../domain/currency-manager';
import type { CurrencyType } from '../domain/currency-transaction';
import type { RepositoryError } from '../errors';

export interface CurrencyManagerRepositoryPort {
  /**
   * 길드의 화폐 관리자 목록 조회
   * @param currencyType - 특정 화폐 타입만 조회 (없으면 전체)
   */
  findByGuild(guildId: string, currencyType?: CurrencyType): Promise<Result<CurrencyManager[], RepositoryError>>;

  /**
   * 특정 유저가 해당 화폐의 관리자인지 확인
   */
  isManager(guildId: string, userId: string, currencyType: CurrencyType): Promise<Result<boolean, RepositoryError>>;

  /**
   * 화폐 관리자 추가
   */
  add(input: CreateCurrencyManagerInput): Promise<Result<CurrencyManager, RepositoryError>>;

  /**
   * 화폐 관리자 제거
   */
  remove(guildId: string, userId: string, currencyType: CurrencyType): Promise<Result<void, RepositoryError>>;
}
