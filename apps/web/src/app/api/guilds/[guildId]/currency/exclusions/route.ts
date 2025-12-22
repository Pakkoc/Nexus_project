import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyBotSettingsChanged } from "@/lib/bot-notify";
import { createCurrencyExclusionSchema } from "@/types/currency";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface ExclusionRow extends RowDataPacket {
  id: number;
  guild_id: string;
  target_type: "channel" | "role";
  target_id: string;
}

function rowToExclusion(row: ExclusionRow) {
  return {
    id: row.id,
    guildId: row.guild_id,
    targetType: row.target_type,
    targetId: row.target_id,
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
    const [rows] = await pool.query<ExclusionRow[]>(
      `SELECT * FROM currency_exclusions WHERE guild_id = ?`,
      [guildId]
    );

    return NextResponse.json(rows.map(rowToExclusion));
  } catch (error) {
    console.error("Error fetching currency exclusions:", error);
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
    const validatedData = createCurrencyExclusionSchema.parse(body);

    const pool = db();

    // Check if already exists
    const [existing] = await pool.query<ExclusionRow[]>(
      `SELECT * FROM currency_exclusions WHERE guild_id = ? AND target_type = ? AND target_id = ?`,
      [guildId, validatedData.targetType, validatedData.targetId]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Exclusion already exists" },
        { status: 409 }
      );
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO currency_exclusions (guild_id, target_type, target_id)
       VALUES (?, ?, ?)`,
      [guildId, validatedData.targetType, validatedData.targetId]
    );

    notifyBotSettingsChanged({
      guildId,
      type: 'currency-exclusion',
      action: '추가',
      details: `${validatedData.targetType}: ${validatedData.targetId}`,
    });

    return NextResponse.json({
      id: result.insertId,
      guildId,
      ...validatedData,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("Error creating currency exclusion:", error);
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
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  try {
    const pool = db();
    await pool.query(
      `DELETE FROM currency_exclusions WHERE id = ? AND guild_id = ?`,
      [id, guildId]
    );

    notifyBotSettingsChanged({
      guildId,
      type: 'currency-exclusion',
      action: '삭제',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting currency exclusion:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
