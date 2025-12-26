import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createShopItemV2Schema } from "@/types/shop-v2";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface ShopItemV2Row extends RowDataPacket {
  id: number;
  guild_id: string;
  name: string;
  description: string | null;
  price: string;
  currency_type: "topy" | "ruby";
  duration_days: number;
  stock: number | null;
  max_per_user: number | null;
  enabled: number;
  created_at: Date;
}

function rowToShopItemV2(row: ShopItemV2Row) {
  return {
    id: row.id,
    guildId: row.guild_id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    currencyType: row.currency_type,
    durationDays: row.duration_days,
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
    const [rows] = await pool.query<ShopItemV2Row[]>(
      "SELECT * FROM shop_items_v2 WHERE guild_id = ? ORDER BY id ASC",
      [guildId]
    );

    return NextResponse.json(rows.map(rowToShopItemV2));
  } catch (error) {
    console.error("Error fetching shop items v2:", error);
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
    const validatedData = createShopItemV2Schema.parse(body);

    const pool = db();
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO shop_items_v2
       (guild_id, name, description, price, currency_type, duration_days, stock, max_per_user, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        guildId,
        validatedData.name,
        validatedData.description ?? null,
        validatedData.price,
        validatedData.currencyType,
        validatedData.durationDays ?? 0,
        validatedData.stock ?? null,
        validatedData.maxPerUser ?? null,
        validatedData.enabled !== false ? 1 : 0,
      ]
    );

    const [rows] = await pool.query<ShopItemV2Row[]>(
      "SELECT * FROM shop_items_v2 WHERE id = ?",
      [result.insertId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Failed to create item" },
        { status: 500 }
      );
    }

    return NextResponse.json(rowToShopItemV2(rows[0]!), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("Error creating shop item v2:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
