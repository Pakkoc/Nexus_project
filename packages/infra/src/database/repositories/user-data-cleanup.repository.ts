import type { Pool } from 'mysql2/promise';
import type { UserDataCleanupPort } from '@topia/core';
import { Result } from '@topia/core';

export class UserDataCleanupRepository implements UserDataCleanupPort {
  constructor(private readonly pool: Pool) {}

  /**
   * 유저의 모든 데이터 삭제 (XP, 화폐, 인벤토리, 거래 기록 등)
   */
  async deleteUserData(guildId: string, userId: string): Promise<Result<void, Error>> {
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();

      // XP 데이터 삭제
      await connection.execute(
        'DELETE FROM xp_users WHERE guild_id = ? AND user_id = ?',
        [guildId, userId]
      );

      // 토피 지갑 삭제
      await connection.execute(
        'DELETE FROM topy_wallets WHERE guild_id = ? AND user_id = ?',
        [guildId, userId]
      );

      // 루비 지갑 삭제
      await connection.execute(
        'DELETE FROM ruby_wallets WHERE guild_id = ? AND user_id = ?',
        [guildId, userId]
      );

      // 거래 기록 삭제
      await connection.execute(
        'DELETE FROM currency_transactions WHERE guild_id = ? AND user_id = ?',
        [guildId, userId]
      );

      // 일일 보상 기록 삭제
      await connection.execute(
        'DELETE FROM daily_rewards WHERE guild_id = ? AND user_id = ?',
        [guildId, userId]
      );

      // 인벤토리 삭제 (v2)
      await connection.execute(
        'DELETE FROM user_items_v2 WHERE guild_id = ? AND user_id = ?',
        [guildId, userId]
      );

      // 구매 기록 삭제
      await connection.execute(
        'DELETE FROM purchase_history WHERE guild_id = ? AND user_id = ?',
        [guildId, userId]
      );

      // 장터 등록 상품 삭제
      await connection.execute(
        'DELETE FROM market_listings WHERE guild_id = ? AND seller_id = ?',
        [guildId, userId]
      );

      // 뱅크 구독 삭제
      await connection.execute(
        'DELETE FROM bank_subscriptions WHERE guild_id = ? AND user_id = ?',
        [guildId, userId]
      );

      // 세금 납부 기록 삭제
      await connection.execute(
        'DELETE FROM tax_history WHERE guild_id = ? AND user_id = ?',
        [guildId, userId]
      );

      // 게임 참여 기록 삭제
      await connection.execute(
        'DELETE FROM game_participants WHERE guild_id = ? AND user_id = ?',
        [guildId, userId]
      );

      await connection.commit();
      return Result.ok(undefined);
    } catch (error) {
      await connection.rollback();
      return Result.err(error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      connection.release();
    }
  }
}
