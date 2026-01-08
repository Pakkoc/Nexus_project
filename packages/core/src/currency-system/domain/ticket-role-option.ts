/**
 * 선택권별 교환 가능한 역할 옵션
 */
export interface TicketRoleOption {
  id: number;
  ticketId: number;
  roleId: string;
  name: string; // 표시 이름 ("빨강", "전사" 등)
  description: string | null;
  topyPrice: bigint | null; // 역할별 토피 가격 (즉시구매용)
  rubyPrice: bigint | null; // 역할별 루비 가격 (즉시구매용)
  displayOrder: number;
  createdAt: Date;
}

export interface CreateTicketRoleOptionInput {
  ticketId: number;
  roleId: string;
  name: string;
  description?: string | null;
  topyPrice?: bigint | null;
  rubyPrice?: bigint | null;
  displayOrder?: number;
}

export interface UpdateTicketRoleOptionInput {
  roleId?: string;
  name?: string;
  description?: string | null;
  topyPrice?: bigint | null;
  rubyPrice?: bigint | null;
  displayOrder?: number;
}
