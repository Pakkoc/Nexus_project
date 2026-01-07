import type { ClockPort } from '../../shared/port/clock.port';
import type { CurrencyError } from '../errors';
import type { ShopRepositoryPort } from '../port/shop-repository.port';
import type { RoleTicketRepositoryPort } from '../port/role-ticket-repository.port';
import type { RoleTicket } from '../domain/role-ticket';
import type { TicketRoleOption } from '../domain/ticket-role-option';
import type { UserItemV2 } from '../domain/user-item-v2';
import type { ShopItemV2, ShopItemType } from '../domain/shop-item';
import type { ColorOption } from '../domain/color-option';
import { Result } from '../../shared/types/result';
import { isPeriodTicket, calculateRoleExpiresAt } from '../domain/role-ticket';
import { isItemV2Expired } from '../domain/user-item-v2';

/** 색상선택권 타입 */
const COLOR_ITEM_TYPES: ShopItemType[] = ['color_basic', 'color_premium'];

export interface AvailableTicket {
  ticket: RoleTicket;
  userItem: UserItemV2;
  shopItem: ShopItemV2;
}

export interface ExchangeRoleResult {
  newRoleId: string;
  fixedRoleId: string | null; // 고정 역할 ID
  removedRoleIds: string[];
  remainingQuantity: number;
  expiresAt: Date | null;
  roleExpiresAt: Date | null;
  isPeriod: boolean;
}

export interface ExpiredItem {
  userItem: UserItemV2;
  roleIdToRevoke: string | null;
  fixedRoleIdToRevoke: string | null; // 고정 역할도 함께 제거
}

/** 유저 보유 아이템 (상점 아이템 정보 포함) */
export interface OwnedItem {
  userItem: UserItemV2;
  shopItem: ShopItemV2;
  /** 선택권 여부 (역할 교환 가능) */
  isTicket: boolean;
  /** 선택권 정보 (isTicket이 true일 때만 존재) */
  ticket?: RoleTicket;
  /** 색상선택권 여부 */
  isColorItem: boolean;
}

/** 사용 가능한 색상선택권 */
export interface AvailableColorItem {
  userItem: UserItemV2;
  shopItem: ShopItemV2;
  colorOptions: ColorOption[];
}

/** 색상 교환 결과 */
export interface ExchangeColorResult {
  newRoleId: string;
  removedRoleIds: string[];
  remainingQuantity: number;
  expiresAt: Date | null;
  roleExpiresAt: Date | null;
  isPeriod: boolean;
  colorName: string;
  colorCode: string;
}

export class InventoryService {
  constructor(
    private readonly shopRepo: ShopRepositoryPort,
    private readonly ticketRepo: RoleTicketRepositoryPort,
    private readonly clock: ClockPort
  ) {}

  /**
   * 유저가 사용 가능한 선택권 목록 조회
   */
  async getAvailableTickets(
    guildId: string,
    userId: string
  ): Promise<Result<AvailableTicket[], CurrencyError>> {
    const now = this.clock.now();

    // 1. 유저의 모든 아이템 조회
    const userItemsResult = await this.shopRepo.findUserItems(guildId, userId);
    if (!userItemsResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: userItemsResult.error } };
    }
    const userItems = userItemsResult.data;

    // 2. 활성화된 모든 선택권 조회
    const ticketsResult = await this.ticketRepo.findEnabledByGuild(guildId);
    if (!ticketsResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: ticketsResult.error } };
    }
    const tickets = ticketsResult.data;

    // 3. 사용 가능한 선택권 필터링
    const availableTickets: AvailableTicket[] = [];

    for (const ticket of tickets) {
      // 해당 선택권에 연결된 상점 아이템을 유저가 보유하고 있는지 확인
      const userItem = userItems.find((item) => item.shopItemId === ticket.shopItemId);
      if (!userItem) continue;

      // 만료 확인
      if (isItemV2Expired(userItem, now)) continue;

      // 일반 선택권: 수량 확인
      if (!isPeriodTicket(ticket) && userItem.quantity < ticket.consumeQuantity) continue;

      // 상점 아이템 정보 조회
      const shopItemResult = await this.shopRepo.findById(ticket.shopItemId);
      if (!shopItemResult.success || !shopItemResult.data) continue;

      availableTickets.push({
        ticket,
        userItem,
        shopItem: shopItemResult.data,
      });
    }

    return { success: true, data: availableTickets };
  }

  /**
   * 유저가 보유한 모든 아이템 조회 (만료/수량 0 제외)
   */
  async getOwnedItems(
    guildId: string,
    userId: string
  ): Promise<Result<OwnedItem[], CurrencyError>> {
    const now = this.clock.now();

    // 1. 유저의 모든 아이템 조회
    const userItemsResult = await this.shopRepo.findUserItems(guildId, userId);
    if (!userItemsResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: userItemsResult.error } };
    }

    // 2. 활성화된 선택권 조회 (선택권 여부 판별용)
    const ticketsResult = await this.ticketRepo.findEnabledByGuild(guildId);
    const tickets = ticketsResult.success ? ticketsResult.data : [];
    const ticketByShopItemId = new Map(tickets.map(t => [t.shopItemId, t]));

    // 3. 유효한 아이템 필터링 및 상점 정보 조회
    const ownedItems: OwnedItem[] = [];

    for (const userItem of userItemsResult.data) {
      // 만료 확인
      if (isItemV2Expired(userItem, now)) continue;

      // 수량 0이고 기간제가 아닌 경우 제외
      if (userItem.quantity <= 0 && userItem.expiresAt === null) continue;

      // 상점 아이템 정보 조회
      const shopItemResult = await this.shopRepo.findById(userItem.shopItemId);
      if (!shopItemResult.success || !shopItemResult.data) continue;

      // 선택권 여부 확인
      const ticket = ticketByShopItemId.get(userItem.shopItemId);

      // 색상선택권 여부 확인
      const isColorItem = COLOR_ITEM_TYPES.includes(shopItemResult.data.itemType);

      ownedItems.push({
        userItem,
        shopItem: shopItemResult.data,
        isTicket: !!ticket,
        ticket,
        isColorItem,
      });
    }

    return { success: true, data: ownedItems };
  }

  /**
   * 특정 선택권의 역할 옵션 목록 조회
   */
  async getTicketRoleOptions(ticketId: number): Promise<Result<RoleTicket | null, CurrencyError>> {
    const result = await this.ticketRepo.findWithOptions(ticketId);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  /**
   * 역할 교환 (핵심 로직)
   */
  async exchangeRole(
    guildId: string,
    userId: string,
    ticketId: number,
    roleOptionId: number
  ): Promise<Result<ExchangeRoleResult, CurrencyError>> {
    const now = this.clock.now();

    // 1. 선택권 조회 (역할 옵션 포함)
    const ticketResult = await this.ticketRepo.findWithOptions(ticketId);
    if (!ticketResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: ticketResult.error } };
    }
    const ticket = ticketResult.data;
    if (!ticket || !ticket.enabled) {
      return { success: false, error: { type: 'TICKET_NOT_FOUND' } };
    }

    // 2. 역할 옵션 확인
    const roleOption = ticket.roleOptions?.find((o) => o.id === roleOptionId);
    if (!roleOption) {
      return { success: false, error: { type: 'ROLE_OPTION_NOT_FOUND' } };
    }

    // 3. 유저 아이템 조회
    const userItemResult = await this.shopRepo.findUserItem(guildId, userId, ticket.shopItemId);
    if (!userItemResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: userItemResult.error } };
    }
    const userItem = userItemResult.data;
    if (!userItem) {
      return { success: false, error: { type: 'ITEM_NOT_OWNED' } };
    }

    // 4. 만료 확인
    if (isItemV2Expired(userItem, now)) {
      return { success: false, error: { type: 'ITEM_EXPIRED' } };
    }

    // 5. 기간제 vs 일반 분기
    const isPeriod = isPeriodTicket(ticket);

    if (!isPeriod) {
      // 일반 선택권: 수량 확인 및 차감
      if (userItem.quantity < ticket.consumeQuantity) {
        return {
          success: false,
          error: {
            type: 'INSUFFICIENT_QUANTITY',
            required: ticket.consumeQuantity,
            available: userItem.quantity,
          },
        };
      }

      // 수량 차감
      const decreaseResult = await this.shopRepo.decreaseUserItemQuantity(
        userItem.id,
        ticket.consumeQuantity
      );
      if (!decreaseResult.success) {
        return { success: false, error: { type: 'REPOSITORY_ERROR', cause: decreaseResult.error } };
      }
    }

    // 6. 이전 역할 제거 목록 구성
    const removedRoleIds: string[] = [];
    if (ticket.removePreviousRole) {
      // 같은 선택권의 모든 역할 ID 수집 (새로 선택한 역할 제외)
      const allRoleIds = ticket.roleOptions?.map((o) => o.roleId) ?? [];
      removedRoleIds.push(...allRoleIds.filter((id) => id !== roleOption.roleId));
    }

    // 7. 역할 효과 만료 시각 계산
    const roleExpiresAt = calculateRoleExpiresAt(ticket, now);

    // 8. 현재 적용 역할 업데이트 (기간제용)
    // 고정 역할이 있으면 함께 저장
    const fixedRoleId = ticket.fixedRoleId;

    // 디버그 로그
    console.log('[INVENTORY_SERVICE] ticket.fixedRoleId:', fixedRoleId);

    if (isPeriod) {
      const updateResult = await this.shopRepo.updateCurrentRole(
        userItem.id,
        roleOption.roleId,
        now,
        roleExpiresAt,
        fixedRoleId // 고정 역할 ID 전달
      );
      if (!updateResult.success) {
        return { success: false, error: { type: 'REPOSITORY_ERROR', cause: updateResult.error } };
      }
    }

    // 9. 결과 반환
    const remainingQuantity = isPeriod
      ? userItem.quantity
      : userItem.quantity - ticket.consumeQuantity;

    return {
      success: true,
      data: {
        newRoleId: roleOption.roleId,
        fixedRoleId, // 고정 역할 ID 포함
        removedRoleIds,
        remainingQuantity,
        expiresAt: userItem.expiresAt,
        roleExpiresAt,
        isPeriod,
      },
    };
  }

  /**
   * 만료된 기간제 아이템 조회 (스케줄러용)
   */
  async getExpiredItems(): Promise<Result<ExpiredItem[], CurrencyError>> {
    const now = this.clock.now();

    const result = await this.shopRepo.findExpiredItems(now);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }

    // 적용 중인 역할(일반 또는 고정)이 있는 것만 필터링
    const expiredItems: ExpiredItem[] = result.data
      .filter((item) => item.currentRoleId !== null || item.fixedRoleId !== null)
      .map((item) => ({
        userItem: item,
        roleIdToRevoke: item.currentRoleId,
        fixedRoleIdToRevoke: item.fixedRoleId, // 고정 역할도 함께 제거
      }));

    return { success: true, data: expiredItems };
  }

  /**
   * 만료된 아이템의 역할 회수 처리 (스케줄러용)
   */
  async markItemExpired(itemId: bigint): Promise<Result<void, CurrencyError>> {
    const result = await this.shopRepo.updateCurrentRole(itemId, null, null, null);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return { success: true, data: undefined };
  }

  /**
   * 역할 효과가 만료된 아이템 조회 (스케줄러용)
   */
  async getRoleExpiredItems(): Promise<Result<ExpiredItem[], CurrencyError>> {
    const now = this.clock.now();

    const result = await this.shopRepo.findRoleExpiredItems(now);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }

    const expiredItems: ExpiredItem[] = result.data.map((item) => ({
      userItem: item,
      roleIdToRevoke: item.currentRoleId,
      fixedRoleIdToRevoke: item.fixedRoleId, // 고정 역할도 함께 제거
    }));

    return { success: true, data: expiredItems };
  }

  /**
   * 역할 효과 만료 처리 (역할만 회수, 아이템 유지)
   * 고정 역할도 함께 제거
   */
  async markRoleExpired(itemId: bigint): Promise<Result<void, CurrencyError>> {
    // 고정 역할도 함께 null로 설정
    const result = await this.shopRepo.updateCurrentRole(itemId, null, null, null, null);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return { success: true, data: undefined };
  }

  // ========== 색상선택권 관련 메서드 ==========

  /**
   * 사용 가능한 색상선택권 목록 조회
   */
  async getAvailableColorItems(
    guildId: string,
    userId: string
  ): Promise<Result<AvailableColorItem[], CurrencyError>> {
    const now = this.clock.now();

    // 1. 유저의 모든 아이템 조회
    const userItemsResult = await this.shopRepo.findUserItems(guildId, userId);
    if (!userItemsResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: userItemsResult.error } };
    }

    const availableColorItems: AvailableColorItem[] = [];

    for (const userItem of userItemsResult.data) {
      // 만료 확인
      if (isItemV2Expired(userItem, now)) continue;

      // 상점 아이템 조회
      const shopItemResult = await this.shopRepo.findById(userItem.shopItemId);
      if (!shopItemResult.success || !shopItemResult.data) continue;

      const shopItem = shopItemResult.data;

      // 색상선택권 타입인지 확인
      if (!COLOR_ITEM_TYPES.includes(shopItem.itemType)) continue;

      // 기본 색상선택권은 수량 확인
      if (shopItem.itemType === 'color_basic' && userItem.quantity < 1) continue;

      // 색상 옵션 조회
      const colorOptionsResult = await this.shopRepo.findColorOptions(shopItem.id);
      if (!colorOptionsResult.success) continue;

      // 색상 옵션이 있는 경우에만 추가
      if (colorOptionsResult.data.length > 0) {
        availableColorItems.push({
          userItem,
          shopItem,
          colorOptions: colorOptionsResult.data,
        });
      }
    }

    return { success: true, data: availableColorItems };
  }

  /**
   * 특정 색상선택권의 색상 옵션 조회
   */
  async getColorOptions(shopItemId: number): Promise<Result<ColorOption[], CurrencyError>> {
    const result = await this.shopRepo.findColorOptions(shopItemId);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return { success: true, data: result.data };
  }

  /**
   * 색상 교환 (색상선택권 사용)
   */
  async exchangeColor(
    guildId: string,
    userId: string,
    shopItemId: number,
    colorOptionId: number
  ): Promise<Result<ExchangeColorResult, CurrencyError>> {
    const now = this.clock.now();

    // 1. 상점 아이템 조회
    const shopItemResult = await this.shopRepo.findById(shopItemId);
    if (!shopItemResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: shopItemResult.error } };
    }
    const shopItem = shopItemResult.data;
    if (!shopItem || !shopItem.enabled) {
      return { success: false, error: { type: 'ITEM_NOT_FOUND' } };
    }

    // 2. 색상선택권 타입 확인
    if (!COLOR_ITEM_TYPES.includes(shopItem.itemType)) {
      return { success: false, error: { type: 'ITEM_NOT_FOUND' } };
    }

    // 3. 색상 옵션 조회
    const colorOptionResult = await this.shopRepo.findColorOptionById(colorOptionId);
    if (!colorOptionResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: colorOptionResult.error } };
    }
    const colorOption = colorOptionResult.data;
    if (!colorOption || colorOption.itemId !== shopItemId) {
      return { success: false, error: { type: 'COLOR_OPTION_NOT_FOUND' } };
    }

    // 4. 유저 아이템 조회
    const userItemResult = await this.shopRepo.findUserItem(guildId, userId, shopItemId);
    if (!userItemResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: userItemResult.error } };
    }
    const userItem = userItemResult.data;
    if (!userItem) {
      return { success: false, error: { type: 'ITEM_NOT_OWNED' } };
    }

    // 5. 만료 확인
    if (isItemV2Expired(userItem, now)) {
      return { success: false, error: { type: 'ITEM_EXPIRED' } };
    }

    // 6. 기간제 vs 일반 분기
    const isPeriod = shopItem.itemType === 'color_premium';

    if (!isPeriod) {
      // 기본 색상선택권: 수량 확인 및 차감
      if (userItem.quantity < 1) {
        return {
          success: false,
          error: {
            type: 'INSUFFICIENT_QUANTITY',
            required: 1,
            available: userItem.quantity,
          },
        };
      }

      // 수량 차감
      const decreaseResult = await this.shopRepo.decreaseUserItemQuantity(userItem.id, 1);
      if (!decreaseResult.success) {
        return { success: false, error: { type: 'REPOSITORY_ERROR', cause: decreaseResult.error } };
      }
    }

    // 7. 모든 색상 옵션의 역할 ID 조회 (이전 역할 제거용)
    const allColorOptionsResult = await this.shopRepo.findColorOptions(shopItemId);
    const removedRoleIds: string[] = [];
    if (allColorOptionsResult.success) {
      removedRoleIds.push(
        ...allColorOptionsResult.data
          .filter((opt) => opt.roleId !== colorOption.roleId)
          .map((opt) => opt.roleId)
      );
    }

    // 8. 역할 효과 만료 시각 계산
    // 기본: 영구 (null), 프리미엄: 아이템 만료일까지
    const roleExpiresAt = isPeriod ? userItem.expiresAt : null;

    // 9. 현재 적용 역할 업데이트
    const updateResult = await this.shopRepo.updateCurrentRole(
      userItem.id,
      colorOption.roleId,
      now,
      roleExpiresAt,
      null // 색상선택권은 고정 역할 없음
    );
    if (!updateResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: updateResult.error } };
    }

    // 10. 결과 반환
    const remainingQuantity = isPeriod ? userItem.quantity : userItem.quantity - 1;

    return {
      success: true,
      data: {
        newRoleId: colorOption.roleId,
        removedRoleIds,
        remainingQuantity,
        expiresAt: userItem.expiresAt,
        roleExpiresAt,
        isPeriod,
        colorName: colorOption.name,
        colorCode: colorOption.color,
      },
    };
  }
}
