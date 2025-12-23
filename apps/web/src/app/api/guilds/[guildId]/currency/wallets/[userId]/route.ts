import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

interface TopyWalletRow extends RowDataPacket {
  guild_id: string;
  user_id: string;
  balance: string;
  total_earned: string;
  daily_earned: number;
  daily_reset_at: Date;
  last_text_earn_at: Date | null;
  last_voice_earn_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface RubyWalletRow extends RowDataPacket {
  guild_id: string;
  user_id: string;
  balance: string;
  total_earned: string;
  created_at: Date;
  updated_at: Date;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string; userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId, userId } = await params;

  try {
    const pool = db();

    const [topyRows] = await pool.query<TopyWalletRow[]>(
      `SELECT * FROM topy_wallets WHERE guild_id = ? AND user_id = ?`,
      [guildId, userId]
    );

    const [rubyRows] = await pool.query<RubyWalletRow[]>(
      `SELECT * FROM ruby_wallets WHERE guild_id = ? AND user_id = ?`,
      [guildId, userId]
    );

    const topy = topyRows[0];
    const ruby = rubyRows[0];

    return NextResponse.json({
      userId,
      topy: topy
        ? {
            balance: topy.balance,
            totalEarned: topy.total_earned,
            dailyEarned: topy.daily_earned,
            dailyResetAt: topy.daily_reset_at,
            lastTextEarnAt: topy.last_text_earn_at,
            lastVoiceEarnAt: topy.last_voice_earn_at,
            createdAt: topy.created_at,
            updatedAt: topy.updated_at,
          }
        : null,
      ruby: ruby
        ? {
            balance: ruby.balance,
            totalEarned: ruby.total_earned,
            createdAt: ruby.created_at,
            updatedAt: ruby.updated_at,
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching wallet:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
