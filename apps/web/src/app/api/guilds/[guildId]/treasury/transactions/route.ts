import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

interface TransactionRow extends RowDataPacket {
  id: bigint;
  guild_id: string;
  currency_type: 'topy' | 'ruby';
  transaction_type: 'transfer_fee' | 'shop_fee' | 'tax' | 'admin_distribute';
  amount: bigint;
  balance_after: bigint;
  related_user_id: string | null;
  description: string | null;
  created_at: Date;
}

interface CountRow extends RowDataPacket {
  total: number;
}

function rowToTransaction(row: TransactionRow) {
  return {
    id: row.id.toString(),
    guildId: row.guild_id,
    currencyType: row.currency_type,
    transactionType: row.transaction_type,
    amount: row.amount.toString(),
    balanceAfter: row.balance_after.toString(),
    relatedUserId: row.related_user_id,
    description: row.description,
    createdAt: row.created_at,
  };
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

  // 쿼리 파라미터
  const searchParams = request.nextUrl.searchParams;
  const transactionType = searchParams.get("type"); // transfer_fee, shop_fee, tax, admin_distribute
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  try {
    const pool = db();

    let whereClause = "WHERE guild_id = ?";
    const queryParams: (string | number)[] = [guildId];

    if (transactionType) {
      whereClause += " AND transaction_type = ?";
      queryParams.push(transactionType);
    }

    // 총 개수 조회
    const [countRows] = await pool.query<CountRow[]>(
      `SELECT COUNT(*) as total FROM treasury_transactions ${whereClause}`,
      queryParams
    );
    const total = countRows[0]?.total ?? 0;

    // 거래 내역 조회
    const [rows] = await pool.query<TransactionRow[]>(
      `SELECT * FROM treasury_transactions ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    );

    return NextResponse.json({
      transactions: rows.map(rowToTransaction),
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching treasury transactions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
