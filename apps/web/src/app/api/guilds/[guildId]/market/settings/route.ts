import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

// ========== Row Interface ==========

interface MarketSettingsRow extends RowDataPacket {
  guild_id: string;
  channel_id: string | null;
  message_id: string | null;
  topy_fee_percent: number;
  ruby_fee_percent: number;
  created_at: Date;
  updated_at: Date;
}

// ========== Mapper ==========

function rowToMarketSettings(row: MarketSettingsRow) {
  return {
    guildId: row.guild_id,
    channelId: row.channel_id,
    messageId: row.message_id,
    topyFeePercent: row.topy_fee_percent,
    rubyFeePercent: row.ruby_fee_percent,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

// ========== Schema ==========

const updateSettingsSchema = z.object({
  topyFeePercent: z.number().min(0).max(100).optional(),
  rubyFeePercent: z.number().min(0).max(100).optional(),
});

// ========== GET: 장터 설정 조회 ==========

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = await params;

    const [rows] = await db().query<MarketSettingsRow[]>(
      `SELECT * FROM market_settings WHERE guild_id = ?`,
      [guildId]
    );

    if (rows.length === 0) {
      // 기본값 반환
      return NextResponse.json({
        guildId,
        channelId: null,
        messageId: null,
        topyFeePercent: 5,
        rubyFeePercent: 3,
        createdAt: null,
        updatedAt: null,
      });
    }

    return NextResponse.json(rowToMarketSettings(rows[0]!));
  } catch (error) {
    console.error("[API] Failed to get market settings:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// ========== PUT: 장터 설정 (수수료) 수정 ==========

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = await params;
    const body = await request.json();

    // Validate request body
    const parseResult = updateSettingsSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "유효하지 않은 요청입니다" },
        { status: 400 }
      );
    }

    const { topyFeePercent, rubyFeePercent } = parseResult.data;

    // Upsert
    await db().query<ResultSetHeader>(
      `INSERT INTO market_settings (guild_id, topy_fee_percent, ruby_fee_percent)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         topy_fee_percent = COALESCE(VALUES(topy_fee_percent), topy_fee_percent),
         ruby_fee_percent = COALESCE(VALUES(ruby_fee_percent), ruby_fee_percent),
         updated_at = CURRENT_TIMESTAMP`,
      [guildId, topyFeePercent ?? 5, rubyFeePercent ?? 3]
    );

    // 업데이트된 설정 조회
    const [rows] = await db().query<MarketSettingsRow[]>(
      `SELECT * FROM market_settings WHERE guild_id = ?`,
      [guildId]
    );

    return NextResponse.json(rowToMarketSettings(rows[0]!));
  } catch (error) {
    console.error("[API] Failed to update market settings:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
