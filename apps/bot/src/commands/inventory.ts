import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  type APIContainerComponent,
} from 'discord.js';
import type { Command } from './types';
import type { AvailableTicket, TicketRoleOption, OwnedItem, ShopItemType, AvailableColorItem, ColorOption } from '@topia/core';

// Components v2 플래그 (1 << 15)
const IS_COMPONENTS_V2 = 32768;

/** 아이템 타입별 라벨 */
const ITEM_TYPE_LABELS: Record<ShopItemType, string> = {
  custom: '🎁 일반',
  warning_reduction: '⚠️ 경고차감',
  tax_exemption: '💸 세금면제',
  transfer_fee_reduction: '💳 수수료감면',
  activity_boost: '🚀 활동부스트',
  premium_afk: '💤 프리미엄잠수',
  vip_lounge: '👑 VIP라운지',
  dito_silver: '🥈 디토실버',
  dito_gold: '🥇 디토골드',
  color_basic: '🎨 색상선택(기본)',
  color_premium: '🌈 색상선택(프리미엄)',
};

/** 인벤토리 Container 생성 (Components v2) - 모든 보유 아이템 */
function createInventoryContainer(
  items: OwnedItem[],
  topyName: string,
  rubyName: string
): APIContainerComponent {
  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('# 🎒 인벤토리')
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  if (items.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('보유한 아이템이 없습니다.\n상점에서 아이템을 구매해보세요!')
    );
    return container.toJSON();
  }

  // 선택권과 일반 아이템 분류
  const ticketItems = items.filter(i => i.isTicket);
  const otherItems = items.filter(i => !i.isTicket);

  // 선택권이 있으면 안내 메시지 표시
  if (ticketItems.length > 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('🎫 **선택권**은 아래 메뉴에서 역할로 교환할 수 있습니다.')
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );
  }

  // 모든 아이템 표시
  items.forEach((item, idx) => {
    const isPeriod = item.shopItem.durationDays > 0;
    const typeLabel = ITEM_TYPE_LABELS[item.shopItem.itemType] || '🎁 일반';

    let info = `**${idx + 1}. ${item.shopItem.name}**\n`;
    info += `${typeLabel}`;

    // 수량 표시 (기간제는 수량 대신 남은 기간)
    if (isPeriod && item.userItem.expiresAt) {
      const expiresAt = new Date(item.userItem.expiresAt);
      const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      info += ` · ⏰ ${daysLeft}일 남음`;
    } else {
      info += ` · 📦 **${item.userItem.quantity}개**`;
    }

    // 선택권인 경우 추가 정보
    if (item.isTicket && item.ticket) {
      const roleCount = item.ticket.roleOptions?.length ?? 0;
      info += ` · 🎭 ${roleCount}개 역할`;
    }

    if (item.shopItem.description) {
      info += `\n> ${item.shopItem.description}`;
    }

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(info)
    );
  });

  return container.toJSON();
}

/** 인벤토리 Container 생성 (선택권용) - 역할 교환 시 사용 */
function createTicketInventoryContainer(
  tickets: AvailableTicket[],
  topyName: string,
  rubyName: string
): APIContainerComponent {
  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('# 🎫 선택권')
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  if (tickets.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('사용 가능한 선택권이 없습니다.')
    );
    return container.toJSON();
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('아래 메뉴에서 사용할 선택권을 선택하세요.')
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  tickets.forEach((t, idx) => {
    const isPeriod = t.ticket.consumeQuantity === 0;

    let info = `**${idx + 1}. ${t.ticket.name}**\n`;
    info += `📦 보유: **${t.userItem.quantity}개**`;

    if (isPeriod) {
      info += ' · ♾️ 기간제';
    } else {
      info += ` · 🔄 ${t.ticket.consumeQuantity}개 소모`;
    }

    if (t.userItem.expiresAt) {
      const expiresAt = new Date(t.userItem.expiresAt);
      const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      info += ` · ⏰ ${daysLeft}일`;
    }

    if (t.ticket.removePreviousRole) {
      info += ' · 🔁 자동제거';
    }

    const roleCount = t.ticket.roleOptions?.length ?? 0;
    info += `\n🎭 ${roleCount}개 역할 선택 가능`;

    if (t.ticket.description) {
      info += `\n> ${t.ticket.description}`;
    }

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(info)
    );
  });

  return container.toJSON();
}

/** 선택권 선택 메뉴 생성 */
function createTicketSelectMenu(
  tickets: AvailableTicket[],
  customId: string
): StringSelectMenuBuilder {
  const options = tickets.slice(0, 25).map((t) => {
    const isPeriod = t.ticket.consumeQuantity === 0;
    const expiresInfo = t.userItem.expiresAt
      ? ` (${Math.ceil((new Date(t.userItem.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}일)`
      : '';

    return {
      label: t.ticket.name,
      description: isPeriod
        ? `기간제${expiresInfo}`
        : `보유: ${t.userItem.quantity}개 / 소모: ${t.ticket.consumeQuantity}개`,
      value: t.ticket.id.toString(),
      emoji: '🎫',
    };
  });

  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('사용할 선택권을 선택하세요')
    .addOptions(options);
}

/** 역할 선택 Container 생성 (Components v2) */
function createRoleSelectContainer(
  ticket: AvailableTicket,
  roleOptions: TicketRoleOption[]
): APIContainerComponent {
  const isPeriod = ticket.ticket.consumeQuantity === 0;
  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# 🎫 ${ticket.ticket.name}`)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('원하는 역할을 선택하세요.')
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  let infoText = `📦 **보유 수량**: ${ticket.userItem.quantity}개\n`;
  infoText += isPeriod ? '♾️ **기간제**: 무제한 변경 가능' : `🔄 **소모 개수**: ${ticket.ticket.consumeQuantity}개`;

  if (ticket.ticket.removePreviousRole) {
    infoText += '\n🔁 **이전 역할**: 자동으로 제거됩니다';
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(infoText)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `**🎭 선택 가능한 역할**\n${roleOptions.map((opt) => `• ${opt.name}`).join('\n')}`
    )
  );

  return container.toJSON();
}

/** 역할 선택 메뉴 생성 */
function createRoleSelectMenu(
  roleOptions: TicketRoleOption[],
  ticketId: number,
  userId: string
): StringSelectMenuBuilder {
  return new StringSelectMenuBuilder()
    .setCustomId(`inv_role_${ticketId}_${userId}`)
    .setPlaceholder('원하는 역할을 선택하세요')
    .addOptions(
      roleOptions.map((opt) => ({
        label: opt.name,
        description: opt.description || undefined,
        value: opt.id.toString(),
        emoji: '🎭',
      }))
    );
}

// ========== 색상선택권 관련 함수 ==========

/** 색상선택권 선택 메뉴 생성 */
function createColorItemSelectMenu(
  colorItems: AvailableColorItem[],
  customId: string
): StringSelectMenuBuilder {
  const options = colorItems.slice(0, 25).map((item) => {
    const isPremium = item.shopItem.itemType === 'color_premium';
    const expiresInfo = item.userItem.expiresAt
      ? ` (${Math.ceil((new Date(item.userItem.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}일)`
      : '';

    return {
      label: item.shopItem.name,
      description: isPremium
        ? `프리미엄${expiresInfo}`
        : `보유: ${item.userItem.quantity}개`,
      value: item.shopItem.id.toString(),
      emoji: isPremium ? '🌈' : '🎨',
    };
  });

  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('사용할 색상선택권을 선택하세요')
    .addOptions(options);
}

/** 색상 옵션 선택 Container 생성 */
function createColorSelectContainer(
  colorItem: AvailableColorItem,
  colorOptions: ColorOption[]
): APIContainerComponent {
  const isPremium = colorItem.shopItem.itemType === 'color_premium';
  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# ${isPremium ? '🌈' : '🎨'} ${colorItem.shopItem.name}`)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('원하는 색상을 선택하세요.')
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  let infoText = `📦 **보유 수량**: ${colorItem.userItem.quantity}개\n`;
  infoText += isPremium ? '♾️ **프리미엄**: 기간 내 무제한 변경' : '🔄 **사용 시**: 1개 소모';

  if (colorItem.userItem.expiresAt) {
    const daysLeft = Math.ceil((new Date(colorItem.userItem.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    infoText += `\n⏰ **남은 기간**: ${daysLeft}일`;
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(infoText)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // 색상 목록 표시 (색상 코드와 함께)
  const colorList = colorOptions.map((opt) => `• ${opt.name} \`${opt.color}\``).join('\n');
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**🎨 선택 가능한 색상**\n${colorList}`)
  );

  return container.toJSON();
}

/** 색상 옵션 선택 메뉴 생성 */
function createColorOptionSelectMenu(
  colorOptions: ColorOption[],
  shopItemId: number,
  userId: string
): StringSelectMenuBuilder {
  return new StringSelectMenuBuilder()
    .setCustomId(`inv_color_opt_${shopItemId}_${userId}`)
    .setPlaceholder('원하는 색상을 선택하세요')
    .addOptions(
      colorOptions.map((opt) => ({
        label: opt.name,
        description: `색상 코드: ${opt.color}`,
        value: opt.id.toString(),
        emoji: '🎨',
      }))
    );
}

/** 색상 교환 확인 Container 생성 */
function createColorConfirmContainer(
  colorItem: AvailableColorItem,
  colorOption: ColorOption
): APIContainerComponent {
  const isPremium = colorItem.shopItem.itemType === 'color_premium';
  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('# ✅ 색상 교환 확인')
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**${colorOption.name}** 색상으로 교환하시겠습니까?`)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  let infoText = `**선택권**: ${colorItem.shopItem.name}\n`;
  infoText += `**선택한 색상**: ${colorOption.name} \`${colorOption.color}\``;

  if (!isPremium) {
    infoText += `\n\n**소모**: 1개 → 남은 수량: ${colorItem.userItem.quantity - 1}개`;
  }

  infoText += '\n\n⚠️ **주의**: 이 선택권의 다른 색상 역할이 있다면 제거됩니다.';

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(infoText)
  );

  return container.toJSON();
}

/** 색상 확인/취소 버튼 생성 */
function createColorConfirmButtons(
  shopItemId: number,
  colorOptionId: number,
  userId: string
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`inv_color_confirm_${shopItemId}_${colorOptionId}_${userId}`)
      .setLabel('교환하기')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId(`inv_back_${userId}`)
      .setLabel('뒤로가기')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('◀️')
  );
}

/** 뒤로가기 버튼 생성 */
function createBackButton(userId: string): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(`inv_back_${userId}`)
    .setLabel('뒤로가기')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('◀️');
}

/** 확인 화면 Container 생성 (Components v2) */
function createConfirmContainer(
  ticket: AvailableTicket,
  roleOption: TicketRoleOption
): APIContainerComponent {
  const isPeriod = ticket.ticket.consumeQuantity === 0;
  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('# ✅ 역할 교환 확인')
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**${roleOption.name}** 역할로 교환하시겠습니까?`)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  let infoText = `**선택권**: ${ticket.ticket.name}\n`;
  infoText += `**선택한 역할**: ${roleOption.name}`;

  if (!isPeriod) {
    infoText += `\n\n**소모**: ${ticket.ticket.consumeQuantity}개 → 남은 수량: ${ticket.userItem.quantity - ticket.ticket.consumeQuantity}개`;
  }

  if (ticket.ticket.removePreviousRole) {
    infoText += '\n\n⚠️ **주의**: 이 선택권의 다른 역할이 있다면 제거됩니다.';
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(infoText)
  );

  return container.toJSON();
}

/** 간단한 메시지 Container 생성 */
function createMessageContainer(title: string, description: string): APIContainerComponent {
  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# ${title}`)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(description)
  );

  return container.toJSON();
}

/** 확인/취소 버튼 생성 */
function createConfirmButtons(
  ticketId: number,
  roleOptionId: number,
  userId: string
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`inv_confirm_${ticketId}_${roleOptionId}_${userId}`)
      .setLabel('교환하기')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId(`inv_back_${userId}`)
      .setLabel('뒤로가기')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('◀️')
  );
}

export const inventoryCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('인벤토리')
    .setDescription('보유한 아이템을 확인하고 선택권은 역할로 교환합니다'),

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

    await interaction.deferReply({ ephemeral: true });

    try {
      // 화폐 설정 조회
      const settingsResult = await container.currencyService.getSettings(guildId);
      const topyName = settingsResult.success && settingsResult.data?.topyName || '토피';
      const rubyName = settingsResult.success && settingsResult.data?.rubyName || '루비';

      // 모든 보유 아이템 조회
      const ownedItemsResult = await container.inventoryService.getOwnedItems(guildId, userId);
      if (!ownedItemsResult.success) {
        await interaction.editReply({
          content: '인벤토리 정보를 불러오는 중 오류가 발생했습니다.',
        });
        return;
      }

      const ownedItems = ownedItemsResult.data;

      // 사용 가능한 선택권 조회 (역할 교환용)
      const ticketsResult = await container.inventoryService.getAvailableTickets(guildId, userId);
      const tickets = ticketsResult.success ? ticketsResult.data : [];

      // 사용 가능한 색상선택권 조회
      const colorItemsResult = await container.inventoryService.getAvailableColorItems(guildId, userId);
      const colorItems = colorItemsResult.success ? colorItemsResult.data : [];

      // 인벤토리가 비어있는 경우
      if (ownedItems.length === 0) {
        await interaction.editReply({
          components: [createInventoryContainer(ownedItems, topyName, rubyName)],
          flags: IS_COMPONENTS_V2,
        });
        return;
      }

      // 상태 관리
      type State =
        | { type: 'ticket_select' }
        | { type: 'role_select'; ticketId: number; roleOptions: TicketRoleOption[] }
        | { type: 'confirm'; ticketId: number; roleOptionId: number; roleOptions: TicketRoleOption[] }
        | { type: 'color_select'; shopItemId: number; colorOptions: ColorOption[] }
        | { type: 'color_confirm'; shopItemId: number; colorOptionId: number; colorOptions: ColorOption[] }
        | { type: 'done' };

      let state: State = { type: 'ticket_select' };

      // 초기 화면 렌더링 (Components v2) - 모든 아이템 + 선택권/색상선택권 메뉴
      const renderTicketSelect = () => {
        const inventoryContainer = createInventoryContainer(ownedItems, topyName, rubyName);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const components: any[] = [inventoryContainer];

        // 선택권이 있으면 선택 메뉴 표시
        if (tickets.length > 0) {
          const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            createTicketSelectMenu(tickets, `inv_ticket_${userId}`)
          );
          components.push(selectRow.toJSON());
        }

        // 색상선택권이 있으면 선택 메뉴 표시
        if (colorItems.length > 0) {
          const colorSelectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            createColorItemSelectMenu(colorItems, `inv_color_${userId}`)
          );
          components.push(colorSelectRow.toJSON());
        }

        return { components, flags: IS_COMPONENTS_V2 };
      };

      const renderRoleSelect = (ticketId: number, roleOptions: TicketRoleOption[]) => {
        const ticket = tickets.find((t) => t.ticket.id === ticketId)!;
        const roleSelectContainer = createRoleSelectContainer(ticket, roleOptions);
        const roleSelectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          createRoleSelectMenu(roleOptions, ticketId, userId)
        );
        const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          createBackButton(userId)
        );
        return { components: [roleSelectContainer, roleSelectRow.toJSON(), backRow.toJSON()], flags: IS_COMPONENTS_V2 };
      };

      const renderConfirm = (ticketId: number, roleOptionId: number, roleOptions: TicketRoleOption[]) => {
        const ticket = tickets.find((t) => t.ticket.id === ticketId)!;
        const roleOption = roleOptions.find((opt) => opt.id === roleOptionId)!;
        const confirmContainer = createConfirmContainer(ticket, roleOption);
        const buttonRow = createConfirmButtons(ticketId, roleOptionId, userId);
        return { components: [confirmContainer, buttonRow.toJSON()], flags: IS_COMPONENTS_V2 };
      };

      // 색상 옵션 선택 화면 렌더링
      const renderColorSelect = (shopItemId: number, colorOptions: ColorOption[]) => {
        const colorItem = colorItems.find((c) => c.shopItem.id === shopItemId)!;
        const colorSelectContainer = createColorSelectContainer(colorItem, colorOptions);
        const colorOptionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          createColorOptionSelectMenu(colorOptions, shopItemId, userId)
        );
        const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          createBackButton(userId)
        );
        return { components: [colorSelectContainer, colorOptionRow.toJSON(), backRow.toJSON()], flags: IS_COMPONENTS_V2 };
      };

      // 색상 교환 확인 화면 렌더링
      const renderColorConfirm = (shopItemId: number, colorOptionId: number, colorOptions: ColorOption[]) => {
        const colorItem = colorItems.find((c) => c.shopItem.id === shopItemId)!;
        const colorOption = colorOptions.find((opt) => opt.id === colorOptionId)!;
        const confirmContainer = createColorConfirmContainer(colorItem, colorOption);
        const buttonRow = createColorConfirmButtons(shopItemId, colorOptionId, userId);
        return { components: [confirmContainer, buttonRow.toJSON()], flags: IS_COMPONENTS_V2 };
      };

      // 초기 렌더링
      const response = await interaction.editReply(renderTicketSelect());

      // 통합 컬렉터
      const collector = response.createMessageComponentCollector({
        filter: (i) => i.user.id === userId,
        time: 120000, // 2분
      });

      collector.on('collect', async (i) => {
        try {
          // 선택권 선택
          if (i.isStringSelectMenu() && i.customId === `inv_ticket_${userId}`) {
            const ticketId = parseInt(i.values[0] ?? '', 10);
            const ticket = tickets.find((t) => t.ticket.id === ticketId);

            if (!ticket) {
              await i.reply({ content: '선택권을 찾을 수 없습니다.', ephemeral: true });
              return;
            }

            // 역할 옵션 조회
            const ticketWithOptions = await container.inventoryService.getTicketRoleOptions(ticketId);
            if (!ticketWithOptions.success || !ticketWithOptions.data) {
              await i.reply({ content: '선택권 정보를 불러오는 중 오류가 발생했습니다.', ephemeral: true });
              return;
            }

            const roleOptions = ticketWithOptions.data.roleOptions ?? [];
            if (roleOptions.length === 0) {
              await i.reply({ content: '이 선택권에 등록된 역할이 없습니다.', ephemeral: true });
              return;
            }

            state = { type: 'role_select', ticketId, roleOptions };
            await i.update(renderRoleSelect(ticketId, roleOptions));
          }

          // 역할 선택
          else if (i.isStringSelectMenu() && i.customId.startsWith(`inv_role_`)) {
            if (state.type !== 'role_select') return;

            const roleOptionId = parseInt(i.values[0] ?? '', 10);
            const roleOption = state.roleOptions.find((opt) => opt.id === roleOptionId);

            if (!roleOption) {
              await i.reply({ content: '역할을 찾을 수 없습니다.', ephemeral: true });
              return;
            }

            state = { type: 'confirm', ticketId: state.ticketId, roleOptionId, roleOptions: state.roleOptions };
            await i.update(renderConfirm(state.ticketId, roleOptionId, state.roleOptions));
          }

          // 색상선택권 선택
          else if (i.isStringSelectMenu() && i.customId === `inv_color_${userId}`) {
            const shopItemId = parseInt(i.values[0] ?? '', 10);
            const colorItem = colorItems.find((c) => c.shopItem.id === shopItemId);

            if (!colorItem) {
              await i.reply({ content: '색상선택권을 찾을 수 없습니다.', ephemeral: true });
              return;
            }

            // 색상 옵션은 이미 colorItem에 포함되어 있음
            const colorOptions = colorItem.colorOptions;
            if (colorOptions.length === 0) {
              await i.reply({ content: '이 색상선택권에 등록된 색상이 없습니다.', ephemeral: true });
              return;
            }

            state = { type: 'color_select', shopItemId, colorOptions };
            await i.update(renderColorSelect(shopItemId, colorOptions));
          }

          // 색상 옵션 선택
          else if (i.isStringSelectMenu() && i.customId.startsWith(`inv_color_opt_`)) {
            if (state.type !== 'color_select') return;

            const colorOptionId = parseInt(i.values[0] ?? '', 10);
            const colorOption = state.colorOptions.find((opt) => opt.id === colorOptionId);

            if (!colorOption) {
              await i.reply({ content: '색상을 찾을 수 없습니다.', ephemeral: true });
              return;
            }

            state = { type: 'color_confirm', shopItemId: state.shopItemId, colorOptionId, colorOptions: state.colorOptions };
            await i.update(renderColorConfirm(state.shopItemId, colorOptionId, state.colorOptions));
          }

          // 뒤로가기 버튼
          else if (i.isButton() && i.customId === `inv_back_${userId}`) {
            if (state.type === 'role_select') {
              state = { type: 'ticket_select' };
              await i.update(renderTicketSelect());
            } else if (state.type === 'confirm') {
              state = { type: 'role_select', ticketId: state.ticketId, roleOptions: state.roleOptions };
              await i.update(renderRoleSelect(state.ticketId, state.roleOptions));
            } else if (state.type === 'color_select') {
              state = { type: 'ticket_select' };
              await i.update(renderTicketSelect());
            } else if (state.type === 'color_confirm') {
              state = { type: 'color_select', shopItemId: state.shopItemId, colorOptions: state.colorOptions };
              await i.update(renderColorSelect(state.shopItemId, state.colorOptions));
            }
          }

          // 확인 버튼
          else if (i.isButton() && i.customId.startsWith(`inv_confirm_`)) {
            if (state.type !== 'confirm') return;

            await i.deferUpdate();

            const { ticketId, roleOptionId, roleOptions } = state;
            const ticket = tickets.find((t) => t.ticket.id === ticketId)!;
            const roleOption = roleOptions.find((opt) => opt.id === roleOptionId)!;

            // 역할 교환 처리
            const exchangeResult = await container.inventoryService.exchangeRole(
              guildId,
              userId,
              ticketId,
              roleOptionId
            );

            if (!exchangeResult.success) {
              let errorMessage = '역할 교환 중 오류가 발생했습니다.';

              switch (exchangeResult.error.type) {
                case 'TICKET_NOT_FOUND':
                  errorMessage = '선택권을 찾을 수 없습니다.';
                  break;
                case 'ROLE_OPTION_NOT_FOUND':
                  errorMessage = '역할 옵션을 찾을 수 없습니다.';
                  break;
                case 'ITEM_NOT_OWNED':
                  errorMessage = '이 선택권을 보유하고 있지 않습니다.';
                  break;
                case 'ITEM_EXPIRED':
                  errorMessage = '선택권의 유효기간이 만료되었습니다.';
                  break;
                case 'INSUFFICIENT_QUANTITY':
                  errorMessage = `수량이 부족합니다. (필요: ${exchangeResult.error.required}개, 보유: ${exchangeResult.error.available}개)`;
                  break;
              }

              await i.editReply({
                components: [createMessageContainer('❌ 교환 실패', errorMessage)],
                flags: IS_COMPONENTS_V2,
              });
              state = { type: 'done' };
              collector.stop();
              return;
            }

            const result = exchangeResult.data;

            // 디버그 로그
            console.log('[INVENTORY] Exchange result:', {
              newRoleId: result.newRoleId,
              fixedRoleId: result.fixedRoleId,
              removedRoleIds: result.removedRoleIds,
            });

            // Discord 역할 부여/제거
            const actuallyRemovedRoleIds: string[] = [];
            try {
              const member = await interaction.guild?.members.fetch(userId);
              if (member) {
                // 이전 역할 제거 (실제로 가지고 있는 역할만)
                for (const roleId of result.removedRoleIds) {
                  try {
                    if (member.roles.cache.has(roleId)) {
                      const role = await interaction.guild?.roles.fetch(roleId);
                      if (role) {
                        await member.roles.remove(role);
                        actuallyRemovedRoleIds.push(roleId);
                      }
                    }
                  } catch (err) {
                    console.error(`역할 제거 실패 (${roleId}):`, err);
                  }
                }

                // 고정 역할 부여 (있는 경우)
                if (result.fixedRoleId) {
                  try {
                    const fixedRole = await interaction.guild?.roles.fetch(result.fixedRoleId);
                    if (fixedRole && !member.roles.cache.has(result.fixedRoleId)) {
                      await member.roles.add(fixedRole);
                    }
                  } catch (err) {
                    console.error(`고정 역할 부여 실패 (${result.fixedRoleId}):`, err);
                  }
                }

                // 새 역할 부여 (교환 가능 역할)
                const newRole = await interaction.guild?.roles.fetch(result.newRoleId);
                if (newRole) {
                  await member.roles.add(newRole);
                }
              }
            } catch (err) {
              console.error('역할 부여/제거 오류:', err);
            }

            // 성공 메시지 Container 생성
            const successContainer = new ContainerBuilder();

            successContainer.addTextDisplayComponents(
              new TextDisplayBuilder().setContent('# ✅ 역할 교환 완료!')
            );

            successContainer.addSeparatorComponents(
              new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
            );

            successContainer.addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`**${roleOption.name}** 역할이 부여되었습니다!`)
            );

            successContainer.addSeparatorComponents(
              new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
            );

            let infoText = `🎭 **교환 역할**: <@&${result.newRoleId}>`;

            // 고정 역할 표시
            if (result.fixedRoleId) {
              infoText += `\n🔒 **고정 역할**: <@&${result.fixedRoleId}>`;
            }

            if (actuallyRemovedRoleIds.length > 0) {
              infoText += `\n🔁 **제거된 역할**: ${actuallyRemovedRoleIds.map((id) => `<@&${id}>`).join(', ')}`;
            }

            if (!result.isPeriod) {
              infoText += `\n📦 **남은 수량**: ${result.remainingQuantity}개`;
            }

            if (result.expiresAt) {
              const daysLeft = Math.ceil((new Date(result.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              infoText += `\n📦 **아이템 유효기간**: ${daysLeft}일 남음`;
            }

            // 역할 효과 만료 시각 표시
            if (result.roleExpiresAt) {
              const roleExpireTimestamp = Math.floor(new Date(result.roleExpiresAt).getTime() / 1000);
              infoText += `\n⏰ **역할 효과 만료**: <t:${roleExpireTimestamp}:R> (<t:${roleExpireTimestamp}:F>)`;
            }

            successContainer.addTextDisplayComponents(
              new TextDisplayBuilder().setContent(infoText)
            );

            await i.editReply({
              components: [successContainer.toJSON()],
              flags: IS_COMPONENTS_V2,
            });

            state = { type: 'done' };
            collector.stop();
          }

          // 색상 교환 확인 버튼
          else if (i.isButton() && i.customId.startsWith(`inv_color_confirm_`)) {
            if (state.type !== 'color_confirm') return;

            await i.deferUpdate();

            const { shopItemId, colorOptionId, colorOptions } = state;
            const colorItem = colorItems.find((c) => c.shopItem.id === shopItemId)!;
            const colorOption = colorOptions.find((opt) => opt.id === colorOptionId)!;

            // 색상 교환 처리
            const exchangeResult = await container.inventoryService.exchangeColor(
              guildId,
              userId,
              shopItemId,
              colorOptionId
            );

            if (!exchangeResult.success) {
              let errorMessage = '색상 교환 중 오류가 발생했습니다.';

              switch (exchangeResult.error.type) {
                case 'ITEM_NOT_FOUND':
                  errorMessage = '색상선택권을 찾을 수 없습니다.';
                  break;
                case 'COLOR_OPTION_NOT_FOUND':
                  errorMessage = '색상 옵션을 찾을 수 없습니다.';
                  break;
                case 'ITEM_NOT_OWNED':
                  errorMessage = '이 색상선택권을 보유하고 있지 않습니다.';
                  break;
                case 'ITEM_EXPIRED':
                  errorMessage = '색상선택권의 유효기간이 만료되었습니다.';
                  break;
                case 'INSUFFICIENT_QUANTITY':
                  errorMessage = `수량이 부족합니다. (필요: ${exchangeResult.error.required}개, 보유: ${exchangeResult.error.available}개)`;
                  break;
              }

              await i.editReply({
                components: [createMessageContainer('❌ 교환 실패', errorMessage)],
                flags: IS_COMPONENTS_V2,
              });
              state = { type: 'done' };
              collector.stop();
              return;
            }

            const result = exchangeResult.data;

            // 디버그 로그
            console.log('[INVENTORY] Color exchange result:', {
              newRoleId: result.newRoleId,
              removedRoleIds: result.removedRoleIds,
              colorName: result.colorName,
              colorCode: result.colorCode,
            });

            // Discord 역할 부여/제거
            const actuallyRemovedRoleIds: string[] = [];
            try {
              const member = await interaction.guild?.members.fetch(userId);
              if (member) {
                // 이전 색상 역할 제거 (실제로 가지고 있는 역할만)
                for (const roleId of result.removedRoleIds) {
                  try {
                    if (member.roles.cache.has(roleId)) {
                      const role = await interaction.guild?.roles.fetch(roleId);
                      if (role) {
                        await member.roles.remove(role);
                        actuallyRemovedRoleIds.push(roleId);
                      }
                    }
                  } catch (err) {
                    console.error(`역할 제거 실패 (${roleId}):`, err);
                  }
                }

                // 새 색상 역할 부여
                const newRole = await interaction.guild?.roles.fetch(result.newRoleId);
                if (newRole) {
                  await member.roles.add(newRole);
                }
              }
            } catch (err) {
              console.error('역할 부여/제거 오류:', err);
            }

            // 성공 메시지 Container 생성
            const successContainer = new ContainerBuilder();

            successContainer.addTextDisplayComponents(
              new TextDisplayBuilder().setContent('# ✅ 색상 교환 완료!')
            );

            successContainer.addSeparatorComponents(
              new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
            );

            successContainer.addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`**${result.colorName}** 색상 역할이 부여되었습니다!`)
            );

            successContainer.addSeparatorComponents(
              new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
            );

            let infoText = `🎨 **색상 역할**: <@&${result.newRoleId}> \`${result.colorCode}\``;

            if (actuallyRemovedRoleIds.length > 0) {
              infoText += `\n🔁 **제거된 역할**: ${actuallyRemovedRoleIds.map((id) => `<@&${id}>`).join(', ')}`;
            }

            if (!result.isPeriod) {
              infoText += `\n📦 **남은 수량**: ${result.remainingQuantity}개`;
            }

            if (result.expiresAt) {
              const daysLeft = Math.ceil((new Date(result.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              infoText += `\n📦 **아이템 유효기간**: ${daysLeft}일 남음`;
            }

            // 역할 효과 만료 시각 표시 (프리미엄 색상선택권)
            if (result.roleExpiresAt) {
              const roleExpireTimestamp = Math.floor(new Date(result.roleExpiresAt).getTime() / 1000);
              infoText += `\n⏰ **역할 효과 만료**: <t:${roleExpireTimestamp}:R> (<t:${roleExpireTimestamp}:F>)`;
            }

            successContainer.addTextDisplayComponents(
              new TextDisplayBuilder().setContent(infoText)
            );

            await i.editReply({
              components: [successContainer.toJSON()],
              flags: IS_COMPONENTS_V2,
            });

            state = { type: 'done' };
            collector.stop();
          }
        } catch (error) {
          console.error('인벤토리 상호작용 오류:', error);
        }
      });

      collector.on('end', async (_, reason) => {
        if (reason === 'time' && state.type !== 'done') {
          try {
            await interaction.editReply({
              components: [createMessageContainer('⏰ 시간 초과', '인벤토리 사용 시간이 초과되었습니다.')],
              flags: IS_COMPONENTS_V2,
            });
          } catch {
            // 무시
          }
        }
      });

    } catch (error) {
      console.error('인벤토리 명령어 오류:', error);
      await interaction.editReply({
        content: '인벤토리 정보를 불러오는 중 오류가 발생했습니다.',
      });
    }
  },
};
