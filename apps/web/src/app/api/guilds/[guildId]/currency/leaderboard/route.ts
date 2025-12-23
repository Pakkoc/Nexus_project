import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

interface LeaderboardRow extends RowDataPacket {
  user_id: string;
  balance: string;
  total_earned: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 100);
  const type = searchParams.get("type") || "topy"; // topy or ruby

  try {
    const pool = db();
    const tableName = type === "ruby" ? "ruby_wallets" : "topy_wallets";

    const [rows] = await pool.query<LeaderboardRow[]>(
      `SELECT user_id, balance, total_earned
       FROM ${tableName}
       WHERE guild_id = ? AND balance > 0
       ORDER BY balance DESC
       LIMIT ?`,
      [guildId, limit]
    );

    const leaderboard = rows.map((row, index) => ({
      rank: index + 1,
      userId: row.user_id,
      balance: row.balance,
      totalEarned: row.total_earned,
    }));

    return NextResponse.json({
      type,
      leaderboard,
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
