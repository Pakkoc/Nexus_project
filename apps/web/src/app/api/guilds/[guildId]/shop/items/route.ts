import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createShopItemSchema } from "@/types/shop";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface ShopItemRow extends RowDataPacket {
  id: number;
  guild_id: string;
  name: string;
  description: string | null;
  price: string;
  currency_type: "topy" | "ruby";
  item_type: string;
  duration_days: number | null;
  role_id: string | null;
  stock: number | null;
  max_per_user: number | null;
  enabled: number;
  created_at: Date;
}

function rowToShopItem(row: ShopItemRow) {
  return {
    id: row.id,
    guildId: row.guild_id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    currencyType: row.currency_type,
    itemType: row.item_type,
    durationDays: row.duration_days,
    roleId: row.role_id,
    stock: row.stock,
    maxPerUser: row.max_per_user,
    enabled: row.enabled === 1,
    createdAt: row.created_at.toISOString(),
  };
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
    const [rows] = await pool.query<ShopItemRow[]>(
      "SELECT * FROM shop_items WHERE guild_id = ? ORDER BY id ASC",
      [guildId]
    );

    return NextResponse.json(rows.map(rowToShopItem));
  } catch (error) {
    console.error("Error fetching shop items:", error);
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
    const validatedData = createShopItemSchema.parse(body);

    const pool = db();
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO shop_items
       (guild_id, name, description, price, currency_type, item_type,
        duration_days, role_id, stock, max_per_user, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        guildId,
        validatedData.name,
        validatedData.description ?? null,
        validatedData.price,
        validatedData.currencyType,
        validatedData.itemType,
        validatedData.durationDays ?? null,
        validatedData.roleId ?? null,
        validatedData.stock ?? null,
        validatedData.maxPerUser ?? null,
      ]
    );

    const [rows] = await pool.query<ShopItemRow[]>(
      "SELECT * FROM shop_items WHERE id = ?",
      [result.insertId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Failed to create item" },
        { status: 500 }
      );
    }

    return NextResponse.json(rowToShopItem(rows[0]!), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("Error creating shop item:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
