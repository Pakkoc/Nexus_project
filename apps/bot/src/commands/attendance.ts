import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from 'discord.js';
import type { Command } from './types';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

export const attendanceCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('출석')
    .setDescription('오늘의 출석 체크를 합니다'),

  async execute(interaction, container) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (!guildId) {
      await interaction.reply({
        content: '서버에서만 사용할 수 있습니다.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      // 화폐 설정 조회
      const settingsResult = await container.currencyService.getSettings(guildId);
      const topyName = settingsResult.success && settingsResult.data?.topyName || '토피';

      const result = await container.currencyService.claimAttendance(guildId, userId);

      if (!result.success) {
        if (result.error.type === 'ALREADY_CLAIMED') {
          const nextClaimAt = result.error.nextClaimAt;
          const timeUntil = formatDistanceToNow(nextClaimAt, { locale: ko, addSuffix: true });

          const alreadyContainer = new ContainerBuilder()
            .setAccentColor(0xFFA500)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('# 📅 이미 출석 완료')
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `오늘은 이미 출석했습니다!\n다음 출석은 **${timeUntil}** 가능합니다.`
              )
            );

          await interaction.editReply({
            components: [alreadyContainer.toJSON()],
            flags: MessageFlags.IsComponentsV2,
          });
          return;
        }

        await interaction.editReply({
          content: '출석 처리 중 오류가 발생했습니다.',
        });
        return;
      }

      const { reward, streakCount, totalCount, newBalance } = result.data;

      const successContainer = new ContainerBuilder()
        .setAccentColor(0x00FF00)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('# ✅ 출석 완료!')
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**+${reward} ${topyName}**를 받았습니다!`)
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `🔥 **연속 출석**: ${streakCount}일\n` +
            `📊 **총 출석**: ${totalCount}회\n` +
            `💰 **현재 잔액**: ${newBalance.toLocaleString()} ${topyName}`
          )
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('-# 매일 자정에 출석이 초기화됩니다')
        );

      await interaction.editReply({
        components: [successContainer.toJSON()],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      console.error('출석 명령어 오류:', error);
      await interaction.editReply({
        content: '출석 처리 중 오류가 발생했습니다.',
      });
    }
  },
};
