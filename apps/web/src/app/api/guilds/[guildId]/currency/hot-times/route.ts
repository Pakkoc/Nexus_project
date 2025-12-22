import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyBotSettingsChanged } from "@/lib/bot-notify";
import { createCurrencyHotTimeSchema } from "@/types/currency";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface HotTimeRow extends RowDataPacket {
  id: number;
  guild_id: string;
  type: "text" | "voice" | "all";
  start_time: string;
  end_time: string;
  multiplier: string;
  enabled: number;
  channel_ids: string | null;
}

function rowToHotTime(row: HotTimeRow) {
  return {
    id: row.id,
    guildId: row.guild_id,
    type: row.type,
    startTime: row.start_time,
    endTime: row.end_time,
    multiplier: parseFloat(row.multiplier),
    enabled: row.enabled === 1,
    channelIds: row.channel_ids ? JSON.parse(row.channel_ids) : [],
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
    const [rows] = await pool.query<HotTimeRow[]>(
      `SELECT * FROM currency_hot_times WHERE guild_id = ? ORDER BY start_time`,
      [guildId]
    );

    return NextResponse.json(rows.map(rowToHotTime));
  } catch (error) {
    console.error("Error fetching currency hot times:", error);
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
    const validatedData = createCurrencyHotTimeSchema.parse(body);

    const pool = db();
    const channelIdsJson = validatedData.channelIds?.length
      ? JSON.stringify(validatedData.channelIds)
      : null;

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO currency_hot_times (guild_id, type, start_time, end_time, multiplier, enabled, channel_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        guildId,
        validatedData.type,
        validatedData.startTime,
        validatedData.endTime,
        validatedData.multiplier,
        validatedData.enabled ? 1 : 0,
        channelIdsJson,
      ]
    );

    notifyBotSettingsChanged({
      guildId,
      type: 'currency-hottime',
      action: '추가',
      details: `${validatedData.startTime} ~ ${validatedData.endTime} (x${validatedData.multiplier})`,
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
    console.error("Error creating currency hot time:", error);
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
      `DELETE FROM currency_hot_times WHERE id = ? AND guild_id = ?`,
      [id, guildId]
    );

    notifyBotSettingsChanged({
      guildId,
      type: 'currency-hottime',
      action: '삭제',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting currency hot time:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
