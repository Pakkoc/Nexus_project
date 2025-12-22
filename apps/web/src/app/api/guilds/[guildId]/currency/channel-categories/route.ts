import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyBotSettingsChanged } from "@/lib/bot-notify";
import { createChannelCategorySchema } from "@/types/currency";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface ChannelCategoryRow extends RowDataPacket {
  id: number;
  guild_id: string;
  channel_id: string;
  category: "normal" | "music" | "afk" | "premium";
}

function rowToChannelCategory(row: ChannelCategoryRow) {
  return {
    id: row.id,
    guildId: row.guild_id,
    channelId: row.channel_id,
    category: row.category,
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
    const [rows] = await pool.query<ChannelCategoryRow[]>(
      `SELECT * FROM currency_channel_categories WHERE guild_id = ?`,
      [guildId]
    );

    return NextResponse.json(rows.map(rowToChannelCategory));
  } catch (error) {
    console.error("Error fetching channel categories:", error);
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
    const validatedData = createChannelCategorySchema.parse(body);

    const pool = db();

    // Check if already exists
    const [existing] = await pool.query<ChannelCategoryRow[]>(
      `SELECT * FROM currency_channel_categories WHERE guild_id = ? AND channel_id = ?`,
      [guildId, validatedData.channelId]
    );

    if (existing.length > 0) {
      // Update existing
      await pool.query(
        `UPDATE currency_channel_categories SET category = ? WHERE id = ?`,
        [validatedData.category, existing[0]!.id]
      );

      notifyBotSettingsChanged({
        guildId,
        type: 'currency-channel-category',
        action: '수정',
        details: `채널 카테고리: ${validatedData.category}`,
      });

      return NextResponse.json({
        id: existing[0]!.id,
        guildId,
        ...validatedData,
      });
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO currency_channel_categories (guild_id, channel_id, category)
       VALUES (?, ?, ?)`,
      [guildId, validatedData.channelId, validatedData.category]
    );

    notifyBotSettingsChanged({
      guildId,
      type: 'currency-channel-category',
      action: '추가',
      details: `채널 카테고리: ${validatedData.category}`,
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
    console.error("Error creating channel category:", error);
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
      `DELETE FROM currency_channel_categories WHERE id = ? AND guild_id = ?`,
      [id, guildId]
    );

    notifyBotSettingsChanged({
      guildId,
      type: 'currency-channel-category',
      action: '삭제',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting channel category:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
