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
}

interface WalletBalanceRow extends RowDataPacket {
  balance: string;
}

interface MaxBalanceRow extends RowDataPacket {
  max_balance: string;
}

// 최대값에 따른 동적 범례 생성 (로그 스케일 하이브리드)
function getDynamicRanges(maxBalance: number): { min: number; max: number; label: string }[] {
  const allRanges = [
    { min: 0, max: 0, label: '0' },
    { min: 1, max: 100, label: '1-100' },
    { min: 101, max: 1000, label: '100-1K' },
    { min: 1001, max: 10000, label: '1K-10K' },
    { min: 10001, max: 100000, label: '10K-100K' },
    { min: 100001, max: 1000000, label: '100K-1M' },
    { min: 1000001, max: Infinity, label: '1M+' },
  ];

  // 최대값을 포함하는 구간까지만 사용
  const ranges: typeof allRanges = [];
  for (const r of allRanges) {
    ranges.push(r);
    if (maxBalance <= r.max) break;
  }
  return ranges;
}

// 동적 범례용 SQL CASE 문 생성
function buildBalanceCaseSQL(ranges: { min: number; max: number; label: string }[]): string {
  const cases = ranges.map(r => {
    if (r.min === 0 && r.max === 0) {
      return `WHEN balance = 0 THEN '${r.label}'`;
    }
    if (r.max === Infinity) {
      return `WHEN balance >= ${r.min} THEN '${r.label}'`;
    }
    return `WHEN balance BETWEEN ${r.min} AND ${r.max} THEN '${r.label}'`;
  });
  return `CASE ${cases.join(' ')} END`;
}

// 지니 계수 계산 (오름차순 정렬된 잔액 배열)
function calculateGiniCoefficient(balances: number[]): number {
  if (balances.length === 0) return 0;
  const n = balances.length;
  const sum = balances.reduce((a, b) => a + b, 0);
  if (sum === 0) return 0;

  const sorted = [...balances].sort((a, b) => a - b);
  let weightedSum = 0;
  for (let i = 0; i < n; i++) {
    weightedSum += (i + 1) * (sorted[i] ?? 0);
  }
  return (2 * weightedSum) / (n * sum) - (n + 1) / n;
}

// 로렌츠 곡선 데이터 계산 (누적 인구 비율 vs 누적 자산 비율)
function calculateLorenzCurve(balances: number[]): { x: number; y: number }[] {
  if (balances.length === 0) return [{ x: 0, y: 0 }, { x: 100, y: 100 }];

  const sorted = [...balances].sort((a, b) => a - b);
  const n = sorted.length;
  const totalWealth = sorted.reduce((a, b) => a + b, 0);

  if (totalWealth === 0) return [{ x: 0, y: 0 }, { x: 100, y: 100 }];

  const points: { x: number; y: number }[] = [{ x: 0, y: 0 }];

  let cumulativeWealth = 0;
  // 10% 간격으로 포인트 생성 (10개 포인트)
  for (let i = 1; i <= 10; i++) {
    const populationIndex = Math.floor((i / 10) * n) - 1;
    cumulativeWealth = sorted.slice(0, populationIndex + 1).reduce((a, b) => a + b, 0);
    points.push({
      x: i * 10,
      y: Math.round((cumulativeWealth / totalWealth) * 100 * 100) / 100,
    });
  }

  return points;
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

    // 1. 최대 보유량 조회
    const [maxResult] = await pool.query<MaxBalanceRow[]>(
      `SELECT COALESCE(MAX(balance), 0) as max_balance FROM topy_wallets WHERE guild_id = ?`,
      [guildId]
    );
    const maxBalance = Number(maxResult[0]?.max_balance ?? 0);

    // 2. 최대값 기반 동적 범례 생성
    const ranges = getDynamicRanges(maxBalance);
    const caseSQL = buildBalanceCaseSQL(ranges);
    const rangeLabels = ranges.map(r => r.label);
    const fieldOrder = rangeLabels.map(l => `'${l}'`).join(', ');

    // 3. 동적 범례로 분포 조회
    const [distributionStats] = await pool.query<WalletDistributionRow[]>(
      `SELECT
        ${caseSQL} as balance_range,
        COUNT(*) as count
       FROM topy_wallets
       WHERE guild_id = ?
       GROUP BY balance_range
       ORDER BY FIELD(balance_range, ${fieldOrder})`,
      [guildId]
    );

    // 전체 통계
    const [walletStats] = await pool.query<WalletStatsRow[]>(
      `SELECT
        COUNT(*) as total_wallets,
        COALESCE(SUM(balance), 0) as total_balance
       FROM topy_wallets
       WHERE guild_id = ?`,
      [guildId]
    );

    const stats = walletStats[0];
    const totalWallets = Number(stats?.total_wallets ?? 0);
    const totalBalance = Number(stats?.total_balance ?? 0);

    // 상위 10% 보유량 계산 (별도 쿼리)
    let top10Percent = 0;
    if (totalWallets > 0) {
      const top10Count = Math.max(1, Math.ceil(totalWallets * 0.1));
      const [top10Stats] = await pool.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(balance), 0) as top10_balance
         FROM (
           SELECT balance FROM topy_wallets
           WHERE guild_id = ?
           ORDER BY balance DESC
           LIMIT ?
         ) as top10`,
        [guildId, top10Count]
      );
      const top10Balance = Number(top10Stats[0]?.["top10_balance"] ?? 0);
      top10Percent = totalBalance > 0 ? Math.round((top10Balance / totalBalance) * 100) : 0;
    }

    // 지니 계수 및 로렌츠 곡선 계산
    let giniCoefficient = 0;
    let lorenzCurve: { x: number; y: number }[] = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
    let bottom80Percent = 0; // 하위 80%가 보유한 자산 비율

    if (totalWallets > 0) {
      const [allBalances] = await pool.query<WalletBalanceRow[]>(
        `SELECT balance FROM topy_wallets WHERE guild_id = ?`,
        [guildId]
      );
      const balances = allBalances.map(row => Number(row.balance));
      giniCoefficient = Math.round(calculateGiniCoefficient(balances) * 100) / 100;
      lorenzCurve = calculateLorenzCurve(balances);

      // 하위 80% 자산 비율 계산
      const point80 = lorenzCurve.find(p => p.x === 80);
      bottom80Percent = point80 ? Math.round(point80.y) : 0;
    }

    const distMap = new Map(distributionStats.map(r => [r.balance_range, Number(r.count)]));

    const distribution = rangeLabels.map(range => ({
      range,
      count: distMap.get(range) ?? 0,
    }));

    return NextResponse.json({
      distribution,
      totalWallets,
      totalBalance,
      top10Percent,
      giniCoefficient,
      lorenzCurve,
      bottom80Percent,
    });
  } catch (error) {
    console.error("Error fetching wallet distribution:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
