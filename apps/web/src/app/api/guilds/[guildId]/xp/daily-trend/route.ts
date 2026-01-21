import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { format, subDays } from "date-fns";

interface DailyXpRow extends RowDataPacket {
  date: string;
  text_xp: string;
  voice_xp: string;
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

    // 최근 7일간 일별 XP 획득량 (currency_transactions에서 earn_text, earn_voice 참조)
    // XP 시스템은 별도 로그가 없으므로 last_text_xp_at, last_voice_xp_at 기반으로 추정
    const [dailyXp] = await pool.query<DailyXpRow[]>(
      `SELECT
        date_range.date,
        COALESCE(SUM(CASE WHEN DATE(xu.last_text_xp_at) = date_range.date THEN 1 ELSE 0 END), 0) as text_xp,
        COALESCE(SUM(CASE WHEN DATE(xu.last_voice_xp_at) = date_range.date THEN 1 ELSE 0 END), 0) as voice_xp
       FROM (
         SELECT DATE(DATE_SUB(NOW(), INTERVAL n DAY)) as date
         FROM (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) days
       ) date_range
       LEFT JOIN xp_users xu ON xu.guild_id = ? AND (
         DATE(xu.last_text_xp_at) = date_range.date OR DATE(xu.last_voice_xp_at) = date_range.date
       )
       GROUP BY date_range.date
       ORDER BY date_range.date ASC`,
      [guildId]
    );

    // 최근 7일 날짜 배열 생성
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      return format(date, 'yyyy-MM-dd');
    });

    // 데이터 맵 생성
    const dataMap = new Map(
      dailyXp.map(row => [format(new Date(row.date), 'yyyy-MM-dd'), {
        text: Number(row.text_xp),
        voice: Number(row.voice_xp),
      }])
    );

    const dailyTrend = last7Days.map(date => ({
      date,
      label: format(new Date(date), 'M/d'),
      textActive: dataMap.get(date)?.text ?? 0,
      voiceActive: dataMap.get(date)?.voice ?? 0,
    }));

    const totalTextActive = dailyTrend.reduce((sum, d) => sum + d.textActive, 0);
    const totalVoiceActive = dailyTrend.reduce((sum, d) => sum + d.voiceActive, 0);

    return NextResponse.json({
      dailyTrend,
      totalTextActive,
      totalVoiceActive,
      period: '7days',
    });
  } catch (error) {
    console.error("Error fetching XP daily trend:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
