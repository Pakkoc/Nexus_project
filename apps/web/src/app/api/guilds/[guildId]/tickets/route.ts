import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createRoleTicketSchema } from "@/types/shop-v2";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

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
}

function rowToRoleTicket(row: RoleTicketRow): RoleTicketResponse {
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

  // Include shop item info if joined
  if (row.item_name !== undefined) {
    ticket.shopItem = {
      id: row.shop_item_id,
      name: row.item_name,
      price: Number(row.item_price),
      currencyType: row.item_currency_type!,
      durationDays: row.item_duration_days!,
    };
  }

  return ticket;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId } = await params;

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
       WHERE rt.guild_id = ?
       ORDER BY rt.id ASC`,
      [guildId]
    );

    return NextResponse.json(rows.map(rowToRoleTicket));
  } catch (error) {
    console.error("Error fetching role tickets:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId } = await params;

  try {
    const body = await request.json();
    const validatedData = createRoleTicketSchema.parse(body);

    const pool = db();

    // Check if shop item exists
    const [shopItems] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM shop_items_v2 WHERE id = ? AND guild_id = ?",
      [validatedData.shopItemId, guildId]
    );

    if (shopItems.length === 0) {
      return NextResponse.json(
        { error: "Shop item not found" },
        { status: 400 }
      );
    }

    // Check if ticket already exists for this shop item
    const [existingTickets] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM role_tickets WHERE shop_item_id = ?",
      [validatedData.shopItemId]
    );

    if (existingTickets.length > 0) {
      return NextResponse.json(
        { error: "A ticket already exists for this shop item" },
        { status: 400 }
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO role_tickets
       (guild_id, name, description, shop_item_id, consume_quantity, remove_previous_role, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        guildId,
        validatedData.name,
        validatedData.description ?? null,
        validatedData.shopItemId,
        validatedData.consumeQuantity ?? 1,
        validatedData.removePreviousRole !== false ? 1 : 0,
        validatedData.enabled !== false ? 1 : 0,
      ]
    );

    const [rows] = await pool.query<RoleTicketRow[]>(
      `SELECT rt.*,
              si.name as item_name,
              si.price as item_price,
              si.currency_type as item_currency_type,
              si.duration_days as item_duration_days
       FROM role_tickets rt
       LEFT JOIN shop_items_v2 si ON rt.shop_item_id = si.id
       WHERE rt.id = ?`,
      [result.insertId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Failed to create ticket" },
        { status: 500 }
      );
    }

    return NextResponse.json(rowToRoleTicket(rows[0]!), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("Error creating role ticket:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
