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
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const offset = (page - 1) * limit;
  const search = searchParams.get("search") || "";

  try {
    const pool = db();

    // 검색 조건
    let whereClause = "WHERE t.guild_id = ?";
    const queryParams: (string | number)[] = [guildId];

    if (search) {
      whereClause += " AND t.user_id LIKE ?";
      queryParams.push(`%${search}%`);
    }

    // 총 개수
    const [countResult] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM topy_wallets t ${whereClause}`,
      queryParams
    );
    const total = (countResult[0] as { total: number }).total;

    // 지갑 목록 (토피 기준 정렬)
    const [topyRows] = await pool.query<TopyWalletRow[]>(
      `SELECT * FROM topy_wallets t ${whereClause}
       ORDER BY t.balance DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    );

    // 루비 지갑 조회
    const userIds = topyRows.map((row) => row.user_id);
    let rubyMap = new Map<string, RubyWalletRow>();

    if (userIds.length > 0) {
      const [rubyRows] = await pool.query<RubyWalletRow[]>(
        `SELECT * FROM ruby_wallets WHERE guild_id = ? AND user_id IN (?)`,
        [guildId, userIds]
      );
      rubyMap = new Map(rubyRows.map((row) => [row.user_id, row]));
    }

    const wallets = topyRows.map((topy) => {
      const ruby = rubyMap.get(topy.user_id);
      return {
        userId: topy.user_id,
        topyBalance: topy.balance,
        topyTotalEarned: topy.total_earned,
        rubyBalance: ruby?.balance || "0",
        rubyTotalEarned: ruby?.total_earned || "0",
        createdAt: topy.created_at,
        updatedAt: topy.updated_at,
      };
    });

    return NextResponse.json({
      wallets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching wallets:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
