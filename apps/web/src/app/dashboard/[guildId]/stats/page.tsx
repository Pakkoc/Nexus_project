"use client";

import { useParams } from "next/navigation";
import { Icon } from "@iconify/react";
import {
  useGuildStats,
  useMemberTrend,
  useCurrencyStats,
  useLevelDistribution,
  useTreasuryStats,
  useWalletDistribution,
  useXpDailyTrend,
} from "@/hooks/queries";
import { MemberTrendChart } from "@/components/charts/member-trend-chart";
import { TransactionDistributionChart } from "@/components/charts/transaction-distribution-chart";
import { LevelDistributionChart } from "@/components/charts/level-distribution-chart";
import { TreasuryTrendChart } from "@/components/charts/treasury-trend-chart";
import { WalletDistributionChart } from "@/components/charts/wallet-distribution-chart";
import { XpDailyTrendChart } from "@/components/charts/xp-daily-trend-chart";
import { ActiveUsersChart } from "@/components/charts/active-users-chart";
import { GiniLorenzChart } from "@/components/charts/gini-lorenz-chart";
import { WelfareHealthChart } from "@/components/charts/welfare-health-chart";

export default function StatsPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;

  const { data: stats, isLoading: statsLoading } = useGuildStats(guildId);
  const { data: monthlyTrend, isLoading: monthlyLoading } = useMemberTrend(guildId, "monthly");
  const { data: yearlyTrend, isLoading: yearlyLoading } = useMemberTrend(guildId, "yearly");
  const { data: currencyStats, isLoading: currencyStatsLoading } = useCurrencyStats(guildId);
  const { data: levelDistribution, isLoading: levelLoading } = useLevelDistribution(guildId);
  const { data: treasuryStats, isLoading: treasuryStatsLoading } = useTreasuryStats(guildId);
  const { data: walletDistribution, isLoading: walletLoading } = useWalletDistribution(guildId);
  const { data: xpDailyTrend, isLoading: xpTrendLoading } = useXpDailyTrend(guildId);

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="animate-fade-up">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
            <Icon icon="solar:chart-2-bold" className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">통계</h1>
            <p className="text-white/50">서버의 전체 통계를 확인하세요</p>
          </div>
        </div>
      </div>

      {/* 핵심 지표 요약 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-fade-up" style={{ animationDelay: "50ms" }}>
        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/50 text-sm">총 멤버</span>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Icon icon="solar:users-group-rounded-bold" className="w-4 h-4 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{stats?.totalMembers?.toLocaleString() ?? "0"}</p>
          <p className="text-xs text-white/40 mt-1">XP 보유: {stats?.membersWithXp?.toLocaleString() ?? "0"}명</p>
        </div>

        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/50 text-sm">오늘 활동</span>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
              <Icon icon="solar:chat-line-bold" className="w-4 h-4 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{((stats?.todayTextActive ?? 0) + (stats?.todayVoiceActive ?? 0)).toLocaleString()}</p>
          <p className="text-xs text-white/40 mt-1">텍스트 {stats?.todayTextActive ?? 0} / 음성 {stats?.todayVoiceActive ?? 0}</p>
        </div>

        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/50 text-sm">총 XP</span>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center">
              <Icon icon="solar:bolt-bold" className="w-4 h-4 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{stats?.totalXp?.toLocaleString() ?? "0"}</p>
          <p className="text-xs text-white/40 mt-1">평균 Lv. {stats?.avgTextLevelExcludeZero ?? 0}</p>
        </div>

        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/50 text-sm">신규 가입 (30일)</span>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Icon icon="solar:user-plus-bold" className="w-4 h-4 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{monthlyTrend?.totalNewMembers?.toLocaleString() ?? "0"}</p>
          <p className="text-xs text-white/40 mt-1">일 평균 {monthlyTrend?.avgDailyNew ?? 0}명</p>
        </div>
      </div>

      {/* ========== 서버 현황 섹션 ========== */}
      <section className="space-y-6 animate-fade-up" style={{ animationDelay: "100ms" }}>
        {/* 섹션 헤더 */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <Icon icon="solar:users-group-rounded-bold" className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">서버 현황</h2>
            <p className="text-sm text-white/40">회원수 변화와 참여율을 확인하세요</p>
          </div>
        </div>

        {/* 차트 그리드 */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {/* 회원수 추이 - 전체 너비 */}
          <div className="lg:col-span-2 bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <Icon icon="solar:graph-up-bold" className="w-5 h-5 text-blue-400" />
              <div>
                <h3 className="font-semibold text-white">회원수 추이</h3>
                <p className="text-xs text-white/40">총 회원수 및 신규 가입 추이</p>
              </div>
            </div>
            <MemberTrendChart
              monthlyData={monthlyTrend?.dailyTrend ?? []}
              yearlyData={yearlyTrend?.dailyTrend ?? []}
              isMonthlyLoading={monthlyLoading}
              isYearlyLoading={yearlyLoading}
            />
          </div>

          {/* 서버 참여율 */}
          <div className="lg:col-span-2 bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <Icon icon="solar:pie-chart-2-bold" className="w-5 h-5 text-blue-400" />
              <div>
                <h3 className="font-semibold text-white">서버 참여율</h3>
                <p className="text-xs text-white/40">XP 보유 멤버 비율</p>
              </div>
            </div>
            <ActiveUsersChart
              totalMembers={stats?.totalMembers ?? 0}
              membersWithXp={stats?.membersWithXp ?? 0}
              todayTextActive={stats?.todayTextActive ?? 0}
              todayVoiceActive={stats?.todayVoiceActive ?? 0}
              isLoading={statsLoading}
            />
          </div>
        </div>
      </section>

      {/* ========== XP 시스템 섹션 ========== */}
      <section className="space-y-6 animate-fade-up" style={{ animationDelay: "150ms" }}>
        {/* 섹션 헤더 */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center">
            <Icon icon="solar:bolt-bold" className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">XP 시스템</h2>
            <p className="text-sm text-white/40">경험치 활동과 레벨 분포를 확인하세요</p>
          </div>
        </div>

        {/* 차트 그리드 */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {/* 일별 XP 활동 추이 */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <Icon icon="solar:graph-up-bold" className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="font-semibold text-white">일별 XP 활동</h3>
                <p className="text-xs text-white/40">최근 7일</p>
              </div>
            </div>
            <XpDailyTrendChart
              data={xpDailyTrend?.dailyTrend ?? []}
              isLoading={xpTrendLoading}
            />
          </div>

          {/* XP 레벨 분포 */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <Icon icon="solar:chart-bold" className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="font-semibold text-white">XP 레벨 분포</h3>
                <p className="text-xs text-white/40">전체 멤버</p>
              </div>
            </div>
            <LevelDistributionChart
              textData={levelDistribution?.textDistribution ?? []}
              voiceData={levelDistribution?.voiceDistribution ?? []}
              isLoading={levelLoading}
            />
          </div>
        </div>
      </section>

      {/* ========== 경제 시스템 섹션 ========== */}
      <section className="space-y-6 animate-fade-up" style={{ animationDelay: "200ms" }}>
        {/* 섹션 헤더 */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
            <Icon icon="solar:wallet-bold" className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">경제 시스템</h2>
            <p className="text-sm text-white/40">화폐 흐름과 분배 현황을 확인하세요</p>
          </div>
        </div>

        {/* 차트 그리드 */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {/* 복지 건전성 지수 */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <Icon icon="solar:scale-bold" className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="font-semibold text-white">복지 건전성 지수</h3>
                <p className="text-xs text-white/40">재분배 vs 통화 발행 비율</p>
              </div>
            </div>
            <WelfareHealthChart
              welfareHealthIndex={treasuryStats?.welfareHealthIndex ?? 100}
              welfareScale={treasuryStats?.welfareScale ?? 0}
              welfareGrade={treasuryStats?.welfareGrade ?? { grade: 'S', label: '최상', description: '' }}
              redistributionAmount={treasuryStats?.redistributionAmount ?? 0}
              emissionAmount={treasuryStats?.emissionAmount ?? 0}
              totalWelfareAmount={treasuryStats?.totalWelfareAmount ?? 0}
              isLoading={treasuryStatsLoading}
            />
          </div>

          {/* 지니계수 (로렌츠 곡선) */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <Icon icon="solar:graph-new-bold" className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="font-semibold text-white">자산 불평등 지수</h3>
                <p className="text-xs text-white/40">로렌츠 곡선</p>
              </div>
            </div>
            <GiniLorenzChart
              lorenzCurve={walletDistribution?.lorenzCurve ?? []}
              giniCoefficient={walletDistribution?.giniCoefficient ?? 0}
              bottom80Percent={walletDistribution?.bottom80Percent ?? 0}
              isLoading={walletLoading}
            />
          </div>

          {/* 지갑 보유량 분포 */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <Icon icon="solar:wallet-bold" className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="font-semibold text-white">지갑 보유량 분포</h3>
                <p className="text-xs text-white/40">토피 기준</p>
              </div>
            </div>
            <WalletDistributionChart
              data={walletDistribution?.distribution ?? []}
              top10Percent={walletDistribution?.top10Percent ?? 0}
              isLoading={walletLoading}
              currencyName="토피"
            />
          </div>

          {/* 거래 유형 분포 */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <Icon icon="solar:chart-2-bold" className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="font-semibold text-white">거래 유형 분포</h3>
                <p className="text-xs text-white/40">최근 30일</p>
              </div>
            </div>
            <TransactionDistributionChart
              data={currencyStats?.distribution ?? []}
              isLoading={currencyStatsLoading}
            />
          </div>

          {/* 국고 추이 */}
          <div className="lg:col-span-2 bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <Icon icon="solar:wallet-money-bold" className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="font-semibold text-white">국고 추이</h3>
                <p className="text-xs text-white/40">최근 7일</p>
              </div>
            </div>
            <TreasuryTrendChart
              data={treasuryStats?.dailyTrend ?? []}
              totalIncome={treasuryStats?.totalIncome ?? 0}
              totalExpense={treasuryStats?.totalExpense ?? 0}
              isLoading={treasuryStatsLoading}
              currencyName="토피"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
