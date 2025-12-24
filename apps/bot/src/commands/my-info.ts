import {
  SlashCommandBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import type { Command } from './types';
import { generateProfileCard, type ProfileCardData } from '../utils/canvas/profile-card';

export const myInfoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('내정보')
    .setDescription('내 프로필 정보를 확인합니다')
    .addUserOption(option =>
      option
        .setName('유저')
        .setDescription('조회할 유저 (미입력 시 본인)')
        .setRequired(false)
    ),

  async execute(interaction, container) {
    const targetUser = interaction.options.getUser('유저') ?? interaction.user;
    const guildId = interaction.guildId;

    if (!guildId || !interaction.guild) {
      await interaction.reply({
        content: '서버에서만 사용할 수 있습니다.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      // 멤버 정보 가져오기
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!member) {
        await interaction.editReply({
          content: '유저 정보를 찾을 수 없습니다.',
        });
        return;
      }

      // XP 정보 가져오기
      const xpResult = await container.xpService.getUserXp(guildId, targetUser.id);
      const userXp = xpResult.success ? xpResult.data : null;

      // 화폐 정보 가져오기
      const walletsResult = await container.currencyService.getWallets(guildId, targetUser.id);
      const wallets = walletsResult.success ? walletsResult.data : { topy: null, ruby: null };

      // 화폐 설정 가져오기
      const settingsResult = await container.currencyService.getSettings(guildId);
      const topyName = settingsResult.success && settingsResult.data?.topyName || '토피';
      const rubyName = settingsResult.success && settingsResult.data?.rubyName || '루비';

      // 프로필 카드 데이터 구성
      const profileData: ProfileCardData = {
        avatarUrl: targetUser.displayAvatarURL({ extension: 'png', size: 256 }),
        displayName: member.displayName,
        joinedAt: member.joinedAt ?? new Date(),
        attendanceCount: 0, // TODO: 출석 시스템 구현 후 연동
        statusMessage: member.presence?.activities[0]?.name,
        voiceLevel: userXp?.level ?? 0, // TODO: voice/chat 분리 시 수정
        chatLevel: userXp?.level ?? 0,
        isPremium: member.premiumSince !== null,
        topyBalance: wallets.topy?.balance ?? BigInt(0),
        rubyBalance: wallets.ruby?.balance ?? BigInt(0),
        topyName,
        rubyName,
        clanName: undefined, // TODO: 클랜 시스템 구현 후 연동
        warningCount: 0, // TODO: 경고 시스템 구현 후 연동
        warningRemovalCount: 0,
        colorTicketCount: 0,
      };

      // 이미지 생성
      const imageBuffer = await generateProfileCard(profileData);
      const attachment = new AttachmentBuilder(imageBuffer, {
        name: 'profile.png',
      });

      // 버튼 생성 (추후 기능 확장용)
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`myinfo_refresh_${targetUser.id}`)
          .setLabel('새로고침')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔄'),
        // TODO: 추후 기능 추가
        // new ButtonBuilder()
        //   .setCustomId(`myinfo_transactions_${targetUser.id}`)
        //   .setLabel('거래내역')
        //   .setStyle(ButtonStyle.Primary),
      );

      await interaction.editReply({
        files: [attachment],
        components: [row],
      });
    } catch (error) {
      console.error('프로필 카드 생성 오류:', error);
      await interaction.editReply({
        content: '프로필 정보를 불러오는 중 오류가 발생했습니다.',
      });
    }
  },
};
