import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateShopItemV2Schema } from "@/types/shop-v2";
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
  { params }: { params: Promise<{ guildId: string; id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId, id } = await params;
  const itemId = parseInt(id, 10);

  try {
    const pool = db();
    const [rows] = await pool.query<ShopItemV2Row[]>(
      "SELECT * FROM shop_items_v2 WHERE id = ? AND guild_id = ?",
      [itemId, guildId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json(rowToShopItemV2(rows[0]!));
  } catch (error) {
    console.error("Error fetching shop item v2:", error);
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
  const itemId = parseInt(id, 10);

  try {
    const body = await request.json();
    const validatedData = updateShopItemV2Schema.parse(body);

    const pool = db();

    // Build update query dynamically
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
    if (validatedData.price !== undefined) {
      updates.push("price = ?");
      values.push(validatedData.price);
    }
    if (validatedData.currencyType !== undefined) {
      updates.push("currency_type = ?");
      values.push(validatedData.currencyType);
    }
    if (validatedData.durationDays !== undefined) {
      updates.push("duration_days = ?");
      values.push(validatedData.durationDays);
    }
    if (validatedData.stock !== undefined) {
      updates.push("stock = ?");
      values.push(validatedData.stock);
    }
    if (validatedData.maxPerUser !== undefined) {
      updates.push("max_per_user = ?");
      values.push(validatedData.maxPerUser);
    }
    if (validatedData.enabled !== undefined) {
      updates.push("enabled = ?");
      values.push(validatedData.enabled ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    values.push(itemId, guildId);
    await pool.execute(
      `UPDATE shop_items_v2 SET ${updates.join(", ")} WHERE id = ? AND guild_id = ?`,
      values
    );

    const [rows] = await pool.query<ShopItemV2Row[]>(
      "SELECT * FROM shop_items_v2 WHERE id = ?",
      [itemId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json(rowToShopItemV2(rows[0]!));
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("Error updating shop item v2:", error);
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

  try {
    const pool = db();

    // Check if item exists
    const [rows] = await pool.query<ShopItemV2Row[]>(
      "SELECT * FROM shop_items_v2 WHERE id = ? AND guild_id = ?",
      [itemId, guildId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Delete associated role tickets first
    await pool.execute(
      "DELETE FROM ticket_role_options WHERE ticket_id IN (SELECT id FROM role_tickets WHERE shop_item_id = ?)",
      [itemId]
    );
    await pool.execute("DELETE FROM role_tickets WHERE shop_item_id = ?", [itemId]);

    // Delete the item
    await pool.execute(
      "DELETE FROM shop_items_v2 WHERE id = ? AND guild_id = ?",
      [itemId, guildId]
    );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting shop item v2:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
