import type { Container } from '@topia/infra';

// 만료된 데이터 체크 간격: 1시간
const DATA_RETENTION_CHECK_INTERVAL = 60 * 60 * 1000;

/**
 * 서버 탈퇴 후 보존 기간이 지난 유저 데이터를 자동 삭제하는 스케줄러
 */
export function startDataRetentionScheduler(container: Container) {
  console.log('[SCHEDULER] Starting data retention scheduler (every 1 hour)');

  // 즉시 한 번 실행
  cleanupExpiredData(container);

  // 주기적으로 실행
  setInterval(() => {
    cleanupExpiredData(container);
  }, DATA_RETENTION_CHECK_INTERVAL);
}

async function cleanupExpiredData(container: Container) {
  console.log('[DATA_RETENTION] Checking for expired member data...');

  try {
    const result = await container.dataRetentionService.cleanupExpiredData();

    if (result.success) {
      if (result.data.cleaned > 0) {
        console.log(`[DATA_RETENTION] Cleaned up data for ${result.data.cleaned} expired members`);
      } else {
        console.log('[DATA_RETENTION] No expired member data found');
      }
    } else {
      console.error('[DATA_RETENTION] Failed to cleanup expired data:', result.error);
    }
  } catch (err) {
    console.error('[DATA_RETENTION] Scheduler error:', err);
  }
}
