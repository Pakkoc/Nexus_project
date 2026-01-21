import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

interface WalletDistributionRow extends RowDataPacket {
  balance_range: string;
  count: number;
}

interface WalletStatsRow extends RowDataPacket {
  total_wallets: number;
  total_balance: string;
  top10_balance: string;
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

    // 보유량 구간별 분포 (topy_wallets 테이블)
    const [distributionStats] = await pool.query<WalletDistributionRow[]>(
      `SELECT
        CASE
          WHEN balance = 0 THEN '0'
          WHEN balance BETWEEN 1 AND 1000 THEN '1-1K'
          WHEN balance BETWEEN 1001 AND 5000 THEN '1K-5K'
          WHEN balance BETWEEN 5001 AND 10000 THEN '5K-10K'
          WHEN balance BETWEEN 10001 AND 50000 THEN '10K-50K'
          WHEN balance BETWEEN 50001 AND 100000 THEN '50K-100K'
          ELSE '100K+'
        END as balance_range,
        COUNT(*) as count
       FROM topy_wallets
       WHERE guild_id = ?
       GROUP BY balance_range
       ORDER BY FIELD(balance_range, '0', '1-1K', '1K-5K', '5K-10K', '10K-50K', '50K-100K', '100K+')`,
      [guildId]
    );

    // 전체 통계 및 상위 10% 보유량
    const [walletStats] = await pool.query<WalletStatsRow[]>(
      `SELECT
        COUNT(*) as total_wallets,
        COALESCE(SUM(balance), 0) as total_balance,
        COALESCE((
          SELECT SUM(balance) FROM (
            SELECT balance FROM topy_wallets
            WHERE guild_id = ?
            ORDER BY balance DESC
            LIMIT CEIL((SELECT COUNT(*) FROM topy_wallets WHERE guild_id = ?) * 0.1)
          ) as top10
        ), 0) as top10_balance
       FROM topy_wallets
       WHERE guild_id = ?`,
      [guildId, guildId, guildId]
    );

    const ranges = ['0', '1-1K', '1K-5K', '5K-10K', '10K-50K', '50K-100K', '100K+'];
    const distMap = new Map(distributionStats.map(r => [r.balance_range, Number(r.count)]));

    const distribution = ranges.map(range => ({
      range,
      count: distMap.get(range) ?? 0,
    }));

    const stats = walletStats[0];
    const totalBalance = Number(stats?.total_balance ?? 0);
    const top10Balance = Number(stats?.top10_balance ?? 0);
    const top10Percent = totalBalance > 0 ? Math.round((top10Balance / totalBalance) * 100) : 0;

    return NextResponse.json({
      distribution,
      totalWallets: Number(stats?.total_wallets ?? 0),
      totalBalance,
      top10Percent,
    });
  } catch (error) {
    console.error("Error fetching wallet distribution:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
