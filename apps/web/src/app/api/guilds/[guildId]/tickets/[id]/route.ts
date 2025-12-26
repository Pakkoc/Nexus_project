import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateRoleTicketSchema } from "@/types/shop-v2";
import type { RowDataPacket } from "mysql2";

interface RoleTicketRow extends RowDataPacket {
  id: number;
  guild_id: string;
  name: string;
  description: string | null;
  shop_item_id: number;
  consume_quantity: number;
  remove_previous_role: number;
  enabled: number;
  created_at: Date;
  // Join fields
  item_name?: string;
  item_price?: string;
  item_currency_type?: "topy" | "ruby";
  item_duration_days?: number;
}

interface RoleOptionRow extends RowDataPacket {
  id: number;
  ticket_id: number;
  role_id: string;
  name: string;
  description: string | null;
  display_order: number;
  created_at: Date;
}

interface RoleOptionResponse {
  id: number;
  ticketId: number;
  roleId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  createdAt: string;
}

interface RoleTicketResponse {
  id: number;
  guildId: string;
  name: string;
  description: string | null;
  shopItemId: number;
  consumeQuantity: number;
  removePreviousRole: boolean;
  enabled: boolean;
  createdAt: string;
  shopItem?: {
    id: number;
    name: string;
    price: number;
    currencyType: "topy" | "ruby";
    durationDays: number;
  };
  roleOptions?: RoleOptionResponse[];
}

function rowToRoleTicket(row: RoleTicketRow, roleOptions?: RoleOptionRow[]): RoleTicketResponse {
  const ticket: RoleTicketResponse = {
    id: row.id,
    guildId: row.guild_id,
    name: row.name,
    description: row.description,
    shopItemId: row.shop_item_id,
    consumeQuantity: row.consume_quantity,
    removePreviousRole: row.remove_previous_role === 1,
    enabled: row.enabled === 1,
    createdAt: row.created_at.toISOString(),
  };

  if (row.item_name !== undefined) {
    ticket.shopItem = {
      id: row.shop_item_id,
      name: row.item_name,
      price: Number(row.item_price),
      currencyType: row.item_currency_type!,
      durationDays: row.item_duration_days!,
    };
  }

  if (roleOptions) {
    ticket.roleOptions = roleOptions.map((opt) => ({
      id: opt.id,
      ticketId: opt.ticket_id,
      roleId: opt.role_id,
      name: opt.name,
      description: opt.description,
      displayOrder: opt.display_order,
      createdAt: opt.created_at.toISOString(),
    }));
  }

  return ticket;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string; id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId, id } = await params;
  const ticketId = parseInt(id, 10);

  try {
    const pool = db();
    const [rows] = await pool.query<RoleTicketRow[]>(
      `SELECT rt.*,
              si.name as item_name,
              si.price as item_price,
              si.currency_type as item_currency_type,
              si.duration_days as item_duration_days
       FROM role_tickets rt
       LEFT JOIN shop_items_v2 si ON rt.shop_item_id = si.id
       WHERE rt.id = ? AND rt.guild_id = ?`,
      [ticketId, guildId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Fetch role options
    const [optionRows] = await pool.query<RoleOptionRow[]>(
      "SELECT * FROM ticket_role_options WHERE ticket_id = ? ORDER BY display_order ASC",
      [ticketId]
    );

    return NextResponse.json(rowToRoleTicket(rows[0]!, optionRows));
  } catch (error) {
    console.error("Error fetching role ticket:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId, id } = await params;
  const ticketId = parseInt(id, 10);

  try {
    const body = await request.json();
    const validatedData = updateRoleTicketSchema.parse(body);

    const pool = db();

    // Check if ticket exists
    const [existingRows] = await pool.query<RoleTicketRow[]>(
      "SELECT * FROM role_tickets WHERE id = ? AND guild_id = ?",
      [ticketId, guildId]
    );

    if (existingRows.length === 0) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Build update query
    const updates: string[] = [];
    const values: unknown[] = [];

    if (validatedData.name !== undefined) {
      updates.push("name = ?");
      values.push(validatedData.name);
    }
    if (validatedData.description !== undefined) {
      updates.push("description = ?");
      values.push(validatedData.description);
    }
    if (validatedData.consumeQuantity !== undefined) {
      updates.push("consume_quantity = ?");
      values.push(validatedData.consumeQuantity);
    }
    if (validatedData.removePreviousRole !== undefined) {
      updates.push("remove_previous_role = ?");
      values.push(validatedData.removePreviousRole ? 1 : 0);
    }
    if (validatedData.enabled !== undefined) {
      updates.push("enabled = ?");
      values.push(validatedData.enabled ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    values.push(ticketId, guildId);
    await pool.execute(
      `UPDATE role_tickets SET ${updates.join(", ")} WHERE id = ? AND guild_id = ?`,
      values
    );

    // Fetch updated ticket
    const [rows] = await pool.query<RoleTicketRow[]>(
      `SELECT rt.*,
              si.name as item_name,
              si.price as item_price,
              si.currency_type as item_currency_type,
              si.duration_days as item_duration_days
       FROM role_tickets rt
       LEFT JOIN shop_items_v2 si ON rt.shop_item_id = si.id
       WHERE rt.id = ?`,
      [ticketId]
    );

    return NextResponse.json(rowToRoleTicket(rows[0]!));
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("Error updating role ticket:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string; id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId, id } = await params;
  const ticketId = parseInt(id, 10);

  try {
    const pool = db();

    // Check if ticket exists
    const [rows] = await pool.query<RoleTicketRow[]>(
      "SELECT * FROM role_tickets WHERE id = ? AND guild_id = ?",
      [ticketId, guildId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Delete role options first
    await pool.execute(
      "DELETE FROM ticket_role_options WHERE ticket_id = ?",
      [ticketId]
    );

    // Delete ticket
    await pool.execute(
      "DELETE FROM role_tickets WHERE id = ? AND guild_id = ?",
      [ticketId, guildId]
    );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting role ticket:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
