import type { Client, TextChannel } from 'discord.js';
import type { Container } from '@topia/infra';
import type { RowDataPacket } from 'mysql2';
import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from 'discord.js';
import { getPool } from '@topia/infra';

interface GuildRow extends RowDataPacket {
  id: string;
}

interface LogChannelRow extends RowDataPacket {
  log_channel_id: string | null;
}

// 매 시간마다 체크 (매월 1일 0시에 이자 지급)
const INTEREST_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

/**
 * 금고 이자 자동 지급 스케줄러
 */
export function startVaultInterestScheduler(client: Client, container: Container) {
  console.log('[SCHEDULER] Starting vault interest scheduler (check every 1 hour)');

  // 주기적으로 실행
  setInterval(() => {
    checkAndProcessVaultInterest(client, container);
  }, INTEREST_CHECK_INTERVAL);
}

/**
 * 오늘이 매월 1일인지 체크하고 이자 지급
 */
async function checkAndProcessVaultInterest(client: Client, container: Container) {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDate();

  // 매월 1일 0시에만 실행
  if (day !== 1 || hour !== 0) {
    return;
  }

  console.log('[VAULT INTEREST] First day of month at 00:00. Processing interest...');

  // 모든 길드에 대해 이자 처리
  const pool = getPool();
  const [guilds] = await pool.query<GuildRow[]>(
    'SELECT id FROM guilds WHERE left_at IS NULL'
  );

  for (const { id: guildId } of guilds) {
    await processGuildInterest(client, container, guildId);
  }
}

/**
 * 특정 길드의 금고 이자 처리
 */
async function processGuildInterest(client: Client, container: Container, guildId: string) {
  try {
    const result = await container.vaultService.processMonthlyInterest(guildId);

    if (!result.success) {
      console.error(`[VAULT INTEREST] Guild ${guildId}: Failed to process -`, result.error);
      return;
    }

    const summary = result.data;

    // 이자를 받은 유저가 없으면 스킵
    if (summary.totalUsers === 0) {
      console.log(`[VAULT INTEREST] Guild ${guildId}: No users to process`);
      return;
    }

    console.log(
      `[VAULT INTEREST] Guild ${guildId}: Processed ${summary.totalUsers} users, ` +
        `total interest: ${summary.totalInterestPaid}`
    );

    // 개인 DM으로 이자 지급 알림 전송
    await sendPersonalInterestNotifications(client, guildId, summary);

    // 이자 지급 완료 알림 전송 (선택적)
    await sendInterestNotification(client, guildId, summary);
  } catch (err) {
    console.error(`[VAULT INTEREST] Guild ${guildId}: Error -`, err);
  }
}

/**
 * 개인 DM으로 이자 지급 알림 전송
 */
async function sendPersonalInterestNotifications(
  client: Client,
  guildId: string,
  summary: {
    processedAt: Date;
    results: Array<{
      userId: string;
      depositedAmount: bigint;
      interestRate: number;
      interestAmount: bigint;
    }>;
  }
) {
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;

  const year = summary.processedAt.getFullYear();
  const month = summary.processedAt.getMonth() + 1;

  for (const result of summary.results) {
    try {
      const member = await guild.members.fetch(result.userId).catch(() => null);
      if (!member) continue;

      const dmContainer = new ContainerBuilder()
        .setAccentColor(0x00BFFF)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('# 🏦 금고 이자 지급')
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**${guild.name}** 서버에서 ${year}년 ${month}월 금고 이자가 지급되었습니다.`
          )
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `💰 **금고 잔액**: ${result.depositedAmount.toLocaleString()} 토피\n` +
            `📈 **이자율**: ${result.interestRate}%\n` +
            `✨ **이자 지급액**: ${result.interestAmount.toLocaleString()} 토피`
          )
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `> 이자는 지갑으로 직접 지급되었습니다.`
          )
        );

      await member.send({
        components: [dmContainer.toJSON()],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (err) {
      // DM 전송 실패는 무시 (DM 비활성화 등)
      console.log(`[VAULT INTEREST] Failed to send DM to user ${result.userId}:`, err);
    }
  }
}

/**
 * 이자 지급 완료 알림 전송
 */
async function sendInterestNotification(
  client: Client,
  guildId: string,
  summary: {
    processedAt: Date;
    totalUsers: number;
    totalInterestPaid: bigint;
  }
) {
  try {
    // currency_settings에서 알림 채널 ID 조회
    const pool = getPool();
    const [rows] = await pool.query<LogChannelRow[]>(
      'SELECT log_channel_id FROM currency_settings WHERE guild_id = ?',
      [guildId]
    );

    const logChannelId = rows[0]?.log_channel_id;
    if (!logChannelId) return;

    const guild = await client.guilds.fetch(guildId);
    const channel = (await guild.channels.fetch(logChannelId)) as TextChannel;
    if (!channel?.isTextBased()) return;

    const year = summary.processedAt.getFullYear();
    const month = summary.processedAt.getMonth() + 1;

    const notificationContainer = new ContainerBuilder()
      .setAccentColor(0x00BFFF)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# 🏦 금고 이자 지급 완료')
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`${year}년 ${month}월 금고 이자가 지급되었습니다.`)
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `👥 **이자 지급 대상**: ${summary.totalUsers}명\n` +
          `💰 **총 이자액**: ${summary.totalInterestPaid.toLocaleString()} 토피`
        )
      );

    await channel.send({
      components: [notificationContainer.toJSON()],
      flags: MessageFlags.IsComponentsV2,
    });
  } catch (err) {
    // 알림 전송 실패는 무시
    console.error(`[VAULT INTEREST] Failed to send notification for guild ${guildId}:`, err);
  }
}
