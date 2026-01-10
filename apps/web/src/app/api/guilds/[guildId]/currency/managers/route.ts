import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { notifyBotSettingsChanged } from "@/lib/bot-notify";

interface CurrencyManagerRow extends RowDataPacket {
  id: number;
  guild_id: string;
  user_id: string;
  currency_type: "topy" | "ruby";
  created_at: Date;
}

const addManagerSchema = z.object({
  userId: z.string().min(1),
  currencyType: z.enum(["topy", "ruby"]),
});

const removeManagerSchema = z.object({
  userId: z.string().min(1),
  currencyType: z.enum(["topy", "ruby"]),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId } = await params;
  const { searchParams } = new URL(request.url);
  const currencyType = searchParams.get("type") as "topy" | "ruby" | null;

  try {
    const pool = db();

    let query = "SELECT * FROM currency_managers WHERE guild_id = ?";
    const queryParams: string[] = [guildId];

    if (currencyType) {
      query += " AND currency_type = ?";
      queryParams.push(currencyType);
    }

    query += " ORDER BY created_at ASC";

    const [rows] = await pool.query<CurrencyManagerRow[]>(query, queryParams);

    return NextResponse.json(
      rows.map((row) => ({
        id: row.id,
        guildId: row.guild_id,
        userId: row.user_id,
        currencyType: row.currency_type,
        createdAt: row.created_at.toISOString(),
      }))
    );
  } catch (error) {
    console.error("Error fetching currency managers:", error);
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
    const { userId, currencyType } = addManagerSchema.parse(body);

    const pool = db();

    // Check if already exists for this currency type
    const [existing] = await pool.query<CurrencyManagerRow[]>(
      "SELECT * FROM currency_managers WHERE guild_id = ? AND user_id = ? AND currency_type = ?",
      [guildId, userId, currencyType]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "User is already a currency manager for this type" },
        { status: 409 }
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO currency_managers (guild_id, user_id, currency_type) VALUES (?, ?, ?)",
      [guildId, userId, currencyType]
    );

    const [rows] = await pool.query<CurrencyManagerRow[]>(
      "SELECT * FROM currency_managers WHERE id = ?",
      [result.insertId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Failed to add currency manager" },
        { status: 500 }
      );
    }

    // Notify bot
    notifyBotSettingsChanged({
      guildId,
      type: "currency-manager",
      action: "추가",
      details: `유저 ID: ${userId}, 타입: ${currencyType}`,
    });

    return NextResponse.json(
      {
        id: rows[0]!.id,
        guildId: rows[0]!.guild_id,
        userId: rows[0]!.user_id,
        currencyType: rows[0]!.currency_type,
        createdAt: rows[0]!.created_at.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error adding currency manager:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    const { userId, currencyType } = removeManagerSchema.parse(body);

    const pool = db();
    await pool.execute(
      "DELETE FROM currency_managers WHERE guild_id = ? AND user_id = ? AND currency_type = ?",
      [guildId, userId, currencyType]
    );

    // Notify bot
    notifyBotSettingsChanged({
      guildId,
      type: "currency-manager",
      action: "삭제",
      details: `유저 ID: ${userId}, 타입: ${currencyType}`,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error removing currency manager:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
