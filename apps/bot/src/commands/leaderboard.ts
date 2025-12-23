import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from './types';

const MEDALS = ['', '', ''];

export const leaderboardCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('랭킹')
    .setDescription('토피 보유량 상위 유저를 조회합니다')
    .addIntegerOption(option =>
      option
        .setName('페이지')
        .setDescription('페이지 번호 (기본: 1)')
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false)
    ),

  async execute(interaction, container) {
    const guildId = interaction.guildId;
    const page = interaction.options.getInteger('페이지') ?? 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    if (!guildId) {
      await interaction.reply({
        content: '서버에서만 사용할 수 있습니다.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const result = await container.currencyService.getLeaderboard(guildId, limit, offset);

    if (!result.success) {
      await interaction.editReply({
        content: '랭킹 정보를 불러오는 중 오류가 발생했습니다.',
      });
      return;
    }

    const wallets = result.data;

    if (wallets.length === 0) {
      await interaction.editReply({
        content: '아직 랭킹 정보가 없습니다.',
      });
      return;
    }

    const lines: string[] = [];

    for (let i = 0; i < wallets.length; i++) {
      const wallet = wallets[i];
      if (!wallet) continue;

      const rank = offset + i + 1;
      const medal = MEDALS[rank - 1] ?? `\`${rank}.\``;

      try {
        const user = await interaction.client.users.fetch(wallet.userId);
        lines.push(
          `${medal} **${user.displayName}** - ${wallet.balance.toLocaleString()} 토피`
        );
      } catch {
        lines.push(
          `${medal} <@${wallet.userId}> - ${wallet.balance.toLocaleString()} 토피`
        );
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('토피 랭킹')
      .setColor(0xFFD700)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `페이지 ${page}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
