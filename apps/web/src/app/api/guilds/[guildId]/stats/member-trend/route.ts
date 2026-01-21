import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { format, subDays, subMonths } from "date-fns";

interface DailyMemberRow extends RowDataPacket {
  date: string;
  new_members: number;
}

interface TotalMembersRow extends RowDataPacket {
  total_before: number;
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
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "monthly"; // monthly or yearly

  try {
    const pool = db();

    // 기간 설정: monthly = 30일, yearly = 365일
    const days = period === "yearly" ? 365 : 30;
    const startDate = subDays(new Date(), days - 1);

    // 기간 시작 전까지의 총 회원수 (기준점)
    const [totalBefore] = await pool.query<TotalMembersRow[]>(
      `SELECT COUNT(*) as total_before
       FROM xp_users
       WHERE guild_id = ? AND DATE(created_at) < ?`,
      [guildId, format(startDate, 'yyyy-MM-dd')]
    );
    const baseTotal = Number(totalBefore[0]?.total_before ?? 0);

    // 일별 신규 가입자 수
    const [dailyNew] = await pool.query<DailyMemberRow[]>(
      `SELECT
        DATE(created_at) as date,
        COUNT(*) as new_members
       FROM xp_users
       WHERE guild_id = ?
         AND DATE(created_at) >= ?
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [guildId, format(startDate, 'yyyy-MM-dd')]
    );

    // 날짜 배열 생성
    const dateArray = Array.from({ length: days }, (_, i) => {
      const date = subDays(new Date(), days - 1 - i);
      return format(date, 'yyyy-MM-dd');
    });

    // 일별 신규 가입자 맵 생성
    const newMembersMap = new Map(
      dailyNew.map(row => [format(new Date(row.date), 'yyyy-MM-dd'), Number(row.new_members)])
    );

    // 누적 총 회원수 계산
    let cumulativeTotal = baseTotal;
    const dailyTrend = dateArray.map(date => {
      const newMembers = newMembersMap.get(date) ?? 0;
      cumulativeTotal += newMembers;
      return {
        date,
        label: format(new Date(date), 'MM-dd'),
        totalMembers: cumulativeTotal,
        newMembers,
      };
    });

    // 통계 요약
    const totalNewMembers = dailyTrend.reduce((sum, d) => sum + d.newMembers, 0);
    const avgDailyNew = Math.round(totalNewMembers / days * 10) / 10;
    const currentTotal = dailyTrend[dailyTrend.length - 1]?.totalMembers ?? 0;

    return NextResponse.json({
      dailyTrend,
      totalNewMembers,
      avgDailyNew,
      currentTotal,
      period,
    });
  } catch (error) {
    console.error("Error fetching member trend:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
