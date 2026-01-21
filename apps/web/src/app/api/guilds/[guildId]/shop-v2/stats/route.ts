import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

interface PopularItemRow extends RowDataPacket {
  item_id: number;
  item_name: string;
  item_type: string;
  purchase_count: number;
  total_revenue: string;
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

    // 인기 아이템 TOP 5 (구매 횟수 기준, 최근 30일)
    const [popularItems] = await pool.query<PopularItemRow[]>(
      `SELECT
        si.id as item_id,
        si.name as item_name,
        si.type as item_type,
        COUNT(ct.id) as purchase_count,
        COALESCE(SUM(ABS(ct.amount)), 0) as total_revenue
       FROM shop_items si
       LEFT JOIN currency_transactions ct ON ct.guild_id = si.guild_id
         AND ct.transaction_type = 'shop_purchase'
         AND ct.description LIKE CONCAT('%', si.name, '%')
         AND ct.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       WHERE si.guild_id = ? AND si.enabled = 1
       GROUP BY si.id, si.name, si.type
       HAVING purchase_count > 0
       ORDER BY purchase_count DESC
       LIMIT 5`,
      [guildId]
    );

    const items = popularItems.map((row, index) => ({
      rank: index + 1,
      id: row.item_id,
      name: row.item_name,
      type: row.item_type,
      purchaseCount: Number(row.purchase_count),
      totalRevenue: Number(row.total_revenue),
    }));

    return NextResponse.json({
      popularItems: items,
      period: '30days',
    });
  } catch (error) {
    console.error("Error fetching shop stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
