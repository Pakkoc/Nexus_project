import {
  SlashCommandBuilder,
  EmbedBuilder,
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
      const result = await container.currencyService.claimAttendance(guildId, userId);

      if (!result.success) {
        if (result.error.type === 'ALREADY_CLAIMED') {
          const nextClaimAt = result.error.nextClaimAt;
          const timeUntil = formatDistanceToNow(nextClaimAt, { locale: ko, addSuffix: true });

          const embed = new EmbedBuilder()
            .setColor(0xFFA500) // Orange
            .setTitle('📅 이미 출석 완료')
            .setDescription(`오늘은 이미 출석했습니다!\n다음 출석은 **${timeUntil}** 가능합니다.`)
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
          return;
        }

        await interaction.editReply({
          content: '출석 처리 중 오류가 발생했습니다.',
        });
        return;
      }

      const { reward, streakCount, totalCount, newBalance } = result.data;

      const embed = new EmbedBuilder()
        .setColor(0x00FF00) // Green
        .setTitle('✅ 출석 완료!')
        .setDescription(`**+${reward} 토피**를 받았습니다!`)
        .addFields(
          { name: '🔥 연속 출석', value: `${streakCount}일`, inline: true },
          { name: '📊 총 출석', value: `${totalCount}회`, inline: true },
          { name: '💰 현재 잔액', value: `${newBalance.toLocaleString()} 토피`, inline: true },
        )
        .setFooter({ text: '매일 자정에 출석이 초기화됩니다' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('출석 명령어 오류:', error);
      await interaction.editReply({
        content: '출석 처리 중 오류가 발생했습니다.',
      });
    }
  },
};
