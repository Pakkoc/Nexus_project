import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyBotSettingsChanged } from "@/lib/bot-notify";
import { createCurrencyHotTimeSchema, updateCurrencyHotTimeSchema } from "@/types/currency";
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

export async function PATCH(
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
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const validatedData = updateCurrencyHotTimeSchema.parse(data);

    const pool = db();

    // Build dynamic update query
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (validatedData.type !== undefined) {
      updates.push("type = ?");
      values.push(validatedData.type);
    }
    if (validatedData.startTime !== undefined) {
      updates.push("start_time = ?");
      values.push(validatedData.startTime);
    }
    if (validatedData.endTime !== undefined) {
      updates.push("end_time = ?");
      values.push(validatedData.endTime);
    }
    if (validatedData.multiplier !== undefined) {
      updates.push("multiplier = ?");
      values.push(validatedData.multiplier);
    }
    if (validatedData.enabled !== undefined) {
      updates.push("enabled = ?");
      values.push(validatedData.enabled ? 1 : 0);
    }
    if (validatedData.channelIds !== undefined) {
      updates.push("channel_ids = ?");
      values.push(validatedData.channelIds.length ? JSON.stringify(validatedData.channelIds) : null);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(id, guildId);
    await pool.query(
      `UPDATE currency_hot_times SET ${updates.join(", ")} WHERE id = ? AND guild_id = ?`,
      values
    );

    notifyBotSettingsChanged({
      guildId,
      type: 'currency-hottime',
      action: '수정',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("Error updating currency hot time:", error);
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
