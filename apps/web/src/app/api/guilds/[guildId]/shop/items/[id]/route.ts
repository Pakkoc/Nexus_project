import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateShopItemSchema } from "@/types/shop";
import type { RowDataPacket } from "mysql2";

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
  { params }: { params: Promise<{ guildId: string; id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId, id } = await params;
  const itemId = parseInt(id, 10);

  if (isNaN(itemId)) {
    return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
  }

  try {
    const pool = db();
    const [rows] = await pool.query<ShopItemRow[]>(
      "SELECT * FROM shop_items WHERE id = ? AND guild_id = ?",
      [itemId, guildId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json(rowToShopItem(rows[0]!));
  } catch (error) {
    console.error("Error fetching shop item:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId, id } = await params;
  const itemId = parseInt(id, 10);

  if (isNaN(itemId)) {
    return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const validatedData = updateShopItemSchema.parse(body);

    const pool = db();

    // Check if item exists
    const [existingRows] = await pool.query<ShopItemRow[]>(
      "SELECT * FROM shop_items WHERE id = ? AND guild_id = ?",
      [itemId, guildId]
    );

    if (existingRows.length === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Build update query
    const fieldMap: Record<string, string> = {
      name: "name",
      description: "description",
      price: "price",
      currencyType: "currency_type",
      itemType: "item_type",
      durationDays: "duration_days",
      roleId: "role_id",
      stock: "stock",
      maxPerUser: "max_per_user",
      enabled: "enabled",
    };

    const updates: string[] = [];
    const values: unknown[] = [];

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (key in validatedData) {
        updates.push(`${dbField} = ?`);
        const val = validatedData[key as keyof typeof validatedData];
        if (key === "enabled") {
          values.push(val ? 1 : 0);
        } else {
          values.push(val ?? null);
        }
      }
    }

    if (updates.length > 0) {
      values.push(itemId);
      await pool.execute(
        `UPDATE shop_items SET ${updates.join(", ")} WHERE id = ?`,
        values
      );
    }

    // Get updated item
    const [rows] = await pool.query<ShopItemRow[]>(
      "SELECT * FROM shop_items WHERE id = ?",
      [itemId]
    );

    return NextResponse.json(rowToShopItem(rows[0]!));
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("Error updating shop item:", error);
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
  const itemId = parseInt(id, 10);

  if (isNaN(itemId)) {
    return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
  }

  try {
    const pool = db();

    // Check if item exists
    const [existingRows] = await pool.query<ShopItemRow[]>(
      "SELECT * FROM shop_items WHERE id = ? AND guild_id = ?",
      [itemId, guildId]
    );

    if (existingRows.length === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await pool.execute("DELETE FROM shop_items WHERE id = ?", [itemId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting shop item:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
