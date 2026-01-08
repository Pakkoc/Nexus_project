"use client";

import { useParams } from "next/navigation";
import { useGuildStats, useMembers } from "@/hooks/queries";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Icon } from "@iconify/react";

export default function XpStatsPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;

  const { data: stats, isLoading: statsLoading } = useGuildStats(guildId);
  const { data: membersData, isLoading: membersLoading } = useMembers(guildId, {
    limit: 10,
    sortBy: "xp",
    sortOrder: "desc",
  });

  const isLoading = statsLoading || membersLoading;

  if (isLoading) {
    return (
      <div className="space-y-8">
        {/* Header Skeleton */}
        <div className="animate-pulse">
          <div className="h-8 w-48 rounded-lg bg-white/10" />
          <div className="h-5 w-64 rounded-lg bg-white/5 mt-2" />
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white/5 rounded-2xl p-6 border border-white/5">
              <div className="h-4 w-24 rounded bg-white/10 mb-3" />
              <div className="h-8 w-20 rounded bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="animate-fade-up">
        <h1 className="text-2xl md:text-3xl font-bold text-white">XP 통계</h1>
        <p className="text-white/50 mt-1">서버의 XP 및 활동 통계를 확인합니다.</p>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          className="group relative bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300 animate-fade-up"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity duration-300" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/50 text-sm">총 멤버</span>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Icon icon="solar:users-group-rounded-linear" className="w-4 h-4 text-white" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">
              {stats?.totalMembers.toLocaleString() ?? 0}
            </p>
            <p className="text-sm text-white/40 mt-1">
              XP 보유: {stats?.membersWithXp.toLocaleString() ?? 0}명 · 평균 레벨: Lv. {stats?.avgLevel ?? 0}
            </p>
          </div>
        </div>

        <div
          className="group relative bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300 animate-fade-up"
          style={{ animationDelay: '50ms' }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity duration-300" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/50 text-sm">총 XP</span>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                <Icon icon="solar:graph-up-linear" className="w-4 h-4 text-white" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">
              {stats?.totalXp.toLocaleString() ?? 0}
            </p>
            <p className="text-sm text-white/40 mt-1">
              최고 레벨: Lv. {stats?.maxLevel ?? 0}
            </p>
          </div>
        </div>

        <div
          className="group relative bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300 animate-fade-up"
          style={{ animationDelay: '100ms' }}
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${stats?.xpEnabled ? 'from-yellow-500/5 to-amber-500/5' : 'from-slate-500/5 to-slate-600/5'} opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity duration-300`} />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/50 text-sm">XP 시스템 상태</span>
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stats?.xpEnabled ? 'from-yellow-500 to-amber-500' : 'from-slate-500 to-slate-600'} flex items-center justify-center`}>
                <Icon icon="solar:bolt-linear" className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {stats?.xpEnabled ? (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">XP 활성</Badge>
              ) : (
                <Badge variant="outline" className="text-white/40 border-white/20">XP 비활성</Badge>
              )}
              {stats?.textXpEnabled && (
                <Badge variant="secondary" className="bg-white/10 text-white/70">텍스트</Badge>
              )}
              {stats?.voiceXpEnabled && (
                <Badge variant="secondary" className="bg-white/10 text-white/70">음성</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Activity Stats */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden animate-fade-up" style={{ animationDelay: '150ms' }}>
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Icon icon="solar:chat-line-bold" className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">텍스트 활동</h3>
                <p className="text-sm text-white/50">채팅 메시지 기반 XP 획득 통계</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <span className="text-white/60">오늘 활동 멤버</span>
              <span className="font-semibold text-white">
                {stats?.todayTextActive.toLocaleString() ?? 0}명
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <span className="text-white/60">텍스트 XP</span>
              {stats?.textXpEnabled ? (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">활성화</Badge>
              ) : (
                <Badge variant="outline" className="text-white/40 border-white/20">비활성화</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden animate-fade-up" style={{ animationDelay: '200ms' }}>
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                <Icon icon="solar:microphone-bold" className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">음성 활동</h3>
                <p className="text-sm text-white/50">음성 채널 기반 XP 획득 통계</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <span className="text-white/60">오늘 활동 멤버</span>
              <span className="font-semibold text-white">
                {stats?.todayVoiceActive.toLocaleString() ?? 0}명
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <span className="text-white/60">음성 XP</span>
              {stats?.voiceXpEnabled ? (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">활성화</Badge>
              ) : (
                <Badge variant="outline" className="text-white/40 border-white/20">비활성화</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden animate-fade-up" style={{ animationDelay: '250ms' }}>
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Icon icon="solar:chart-2-bold" className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">리더보드</h3>
              <p className="text-sm text-white/50">XP 상위 멤버</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          {membersData && membersData.members.length > 0 ? (
            <div className="space-y-3">
              {membersData.members.map((member, index) => (
                <div
                  key={member.userId}
                  className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 p-4 transition-all"
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${
                      index === 0
                        ? "bg-gradient-to-br from-amber-400 to-amber-600 text-black"
                        : index === 1
                        ? "bg-gradient-to-br from-slate-300 to-slate-500 text-black"
                        : index === 2
                        ? "bg-gradient-to-br from-amber-600 to-amber-800 text-white"
                        : "bg-white/10 text-white/70"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <Avatar className="h-10 w-10 rounded-xl">
                    <AvatarImage src={member.avatar ?? undefined} />
                    <AvatarFallback className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                      {member.displayName?.[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate font-medium text-white">
                      {member.displayName ?? member.username ?? member.userId}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-xs text-white/40">레벨</p>
                      <p className="font-bold text-indigo-400">{member.level}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/40">XP</p>
                      <p className="font-bold text-green-400">
                        {member.xp.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                <Icon icon="solar:chart-2-linear" className="w-8 h-8 text-white/20" />
              </div>
              <p className="text-white/50">아직 데이터가 없습니다.</p>
              <p className="text-sm text-white/30 mt-1">
                멤버들이 활동하면 리더보드가 표시됩니다.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600/20 to-indigo-600/20 backdrop-blur-sm rounded-2xl border border-blue-500/30 p-6 animate-fade-up" style={{ animationDelay: '300ms' }}>
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shrink-0">
            <Icon icon="solar:info-circle-bold" className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-blue-300 mb-1">안내</h4>
            <p className="text-white/70">
              통계 데이터는 봇이 서버에서 XP를 수집하면서 업데이트됩니다.
            </p>
            <p className="mt-1 text-sm text-white/50">
              XP 시스템을 활성화하고 멤버들이 채팅/음성 활동을 하면 데이터가 쌓입니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
