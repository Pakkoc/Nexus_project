import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { format, subDays } from "date-fns";

interface DailyStatsRow extends RowDataPacket {
  date: string;
  transaction_type: string;
  total_amount: string;
}

interface TreasuryBalanceRow extends RowDataPacket {
  topy_balance: bigint;
}

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  transfer_fee: '이체 수수료',
  shop_fee: '상점 수수료',
  tax: '세금',
  admin_distribute: '관리자 지급',
};

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

    // 최근 7일간 일별 국고 수입/지출 (topy 기준)
    const [dailyStats] = await pool.query<DailyStatsRow[]>(
      `SELECT
        DATE(created_at) as date,
        transaction_type,
        COALESCE(SUM(amount), 0) as total_amount
       FROM treasury_transactions
       WHERE guild_id = ?
         AND currency_type = 'topy'
         AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY DATE(created_at), transaction_type
       ORDER BY date ASC`,
      [guildId]
    );

    // 최근 7일 날짜 배열 생성
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      return format(date, 'yyyy-MM-dd');
    });

    // 수입 유형: transfer_fee, shop_fee, tax
    // 지출 유형: admin_distribute
    const incomeTypes = ['transfer_fee', 'shop_fee', 'tax'];
    const expenseTypes = ['admin_distribute'];

    // 일별 데이터 맵 생성
    const dailyMap = new Map<string, { income: number; expense: number }>();
    for (const date of last7Days) {
      dailyMap.set(date, { income: 0, expense: 0 });
    }

    for (const row of dailyStats) {
      const dateStr = format(new Date(row.date), 'yyyy-MM-dd');
      const amount = Number(row.total_amount);
      const data = dailyMap.get(dateStr);
      if (data) {
        if (incomeTypes.includes(row.transaction_type)) {
          data.income += amount;
        } else if (expenseTypes.includes(row.transaction_type)) {
          data.expense += amount;
        }
      }
    }

    // 현재 국고 잔액 조회
    const [treasuryRows] = await pool.query<TreasuryBalanceRow[]>(
      `SELECT topy_balance FROM guild_treasury WHERE guild_id = ?`,
      [guildId]
    );
    const currentBalance = Number(treasuryRows[0]?.topy_balance ?? 0);

    // 일별 데이터 생성 (역순으로 잔액 계산)
    const dailyTrendRaw = last7Days.map(date => ({
      date,
      label: format(new Date(date), 'M/d'),
      income: dailyMap.get(date)?.income ?? 0,
      expense: dailyMap.get(date)?.expense ?? 0,
    }));

    // 일별 잔액 계산 (현재 잔액에서 역산)
    let runningBalance = currentBalance;
    const dailyTrend = [...dailyTrendRaw].reverse().map((day, index) => {
      if (index === 0) {
        // 가장 최근 날짜는 현재 잔액
        return { ...day, balance: runningBalance };
      }
      // 이전 날짜들은 해당 일의 순변동을 더해서 역산
      const prevDay = dailyTrendRaw[dailyTrendRaw.length - index];
      if (prevDay) {
        runningBalance = runningBalance - prevDay.income + prevDay.expense;
      }
      return { ...day, balance: runningBalance };
    }).reverse();

    // 유형별 합계
    const typeStats = new Map<string, number>();
    for (const row of dailyStats) {
      const current = typeStats.get(row.transaction_type) ?? 0;
      typeStats.set(row.transaction_type, current + Number(row.total_amount));
    }

    const byType = Array.from(typeStats.entries()).map(([type, amount]) => ({
      type,
      label: TRANSACTION_TYPE_LABELS[type] ?? type,
      amount,
    }));

    const totalIncome = dailyTrend.reduce((sum, d) => sum + d.income, 0);
    const totalExpense = dailyTrend.reduce((sum, d) => sum + d.expense, 0);

    // 복지 건전성 지수 계산
    // 재분배(수입에서 다시 지급) vs 통화 발행(새로 찍어낸 돈)
    // 건전성 = 재분배 비율 = 재분배 / (재분배 + 발행) * 100
    const [welfareStats] = await pool.query<RowDataPacket[]>(
      `SELECT
        COALESCE(SUM(CASE WHEN transaction_type = 'admin_distribute' THEN amount ELSE 0 END), 0) as total_distribute,
        COALESCE(SUM(CASE WHEN transaction_type IN ('transfer_fee', 'shop_fee', 'tax') THEN amount ELSE 0 END), 0) as total_income
       FROM treasury_transactions
       WHERE guild_id = ? AND currency_type = 'topy'`,
      [guildId]
    );

    const totalDistribute = Number(welfareStats[0]?.["total_distribute"] ?? 0);
    const totalRedistributionIncome = Number(welfareStats[0]?.["total_income"] ?? 0);

    // 재분배 금액: 국고 수입 중 실제 지급된 금액 (min(수입, 지급))
    const redistributionAmount = Math.min(totalRedistributionIncome, totalDistribute);
    // 발행 금액: 수입을 초과하여 지급한 금액 (지급 - 수입, 0 이상)
    const emissionAmount = Math.max(0, totalDistribute - totalRedistributionIncome);
    // 전체 복지 금액
    const totalWelfareAmount = redistributionAmount + emissionAmount;

    // 복지 건전성 지수 = 재분배 비율 (0~100%)
    // 재분배 비율이 높을수록 건전, 발행 비율이 높을수록 포퓰리즘
    const welfareHealthIndex = totalWelfareAmount > 0
      ? Math.round((redistributionAmount / totalWelfareAmount) * 100)
      : 100; // 복지 지출이 없으면 100% (건전)

    // 복지 규모 = 전체 복지 지출 / 총 국고 수입 * 100
    const welfareScale = totalRedistributionIncome > 0
      ? Math.round((totalDistribute / totalRedistributionIncome) * 100)
      : 0;

    // 등급 계산
    const getWelfareGrade = (score: number): { grade: string; label: string; description: string } => {
      if (score >= 90) return { grade: 'S', label: '최상', description: '이상적 재분배: 세수가 경제 시스템 내에서 완벽하게 선순환됨' };
      if (score >= 75) return { grade: 'A', label: '양호', description: '안정적 복지: 적절한 신규 통화 발행과 재분배가 조화를 이룸' };
      if (score >= 50) return { grade: 'B', label: '주의', description: '포퓰리즘 경계: 생산성 없는 통화 발행이 늘어나 물가 상승 위험이 있음' };
      return { grade: 'C', label: '위험', description: '신생/과도기: 국가 재정이 부족하여 돈을 찍어서 복지를 유지하는 단계' };
    };

    const welfareGrade = getWelfareGrade(welfareHealthIndex);

    return NextResponse.json({
      dailyTrend,
      byType,
      totalIncome,
      totalExpense,
      // 복지 건전성 지수
      welfareHealthIndex,
      welfareScale,
      welfareGrade,
      redistributionAmount,
      emissionAmount,
      totalWelfareAmount,
      // 기존 호환성 유지
      welfareIndex: welfareScale,
      period: '7days',
    });
  } catch (error) {
    console.error("Error fetching treasury stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
