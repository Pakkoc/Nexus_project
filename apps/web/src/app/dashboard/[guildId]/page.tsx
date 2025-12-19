"use client";

import { useParams } from "next/navigation";
import { useGuilds, useGuildStats } from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { DiscordIcon } from "@/components/icons/discord-icon";
import { getBotInviteUrl } from "@/lib/discord";

export default function GuildDashboardPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { data: guilds, isLoading: guildsLoading } = useGuilds();
  const { data: stats, isLoading: statsLoading } = useGuildStats(guildId);

  const guild = guilds?.find((g) => g.id === guildId);
  const isLoading = guildsLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="space-y-8">
        {/* Header Skeleton */}
        <div className="animate-pulse">
          <div className="h-8 w-48 rounded-lg bg-white/10" />
          <div className="h-5 w-64 rounded-lg bg-white/5 mt-2" />
        </div>

        {/* Stats Skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white/5 rounded-2xl p-6 border border-white/5">
              <div className="h-4 w-24 rounded bg-white/10 mb-3" />
              <div className="h-8 w-16 rounded bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const mainStats = [
    {
      label: "총 멤버",
      value: stats?.totalMembers.toLocaleString() ?? "0",
      subValue: stats?.membersWithXp ? `XP 보유: ${stats.membersWithXp.toLocaleString()}명` : undefined,
      icon: "solar:users-group-rounded-linear",
      color: "from-blue-500 to-cyan-500",
    },
    {
      label: "오늘 텍스트 활동",
      value: stats?.todayTextActive.toLocaleString() ?? "0",
      subValue: "명",
      icon: "solar:chat-line-linear",
      color: "from-green-500 to-emerald-500",
    },
    {
      label: "오늘 음성 활동",
      value: stats?.todayVoiceActive.toLocaleString() ?? "0",
      subValue: "명",
      icon: "solar:microphone-linear",
      color: "from-purple-500 to-pink-500",
    },
    {
      label: "XP 시스템",
      value: stats?.xpEnabled ? "활성" : "비활성",
      isStatus: true,
      isActive: stats?.xpEnabled,
      icon: "solar:bolt-linear",
      color: stats?.xpEnabled ? "from-yellow-500 to-amber-500" : "from-slate-500 to-slate-600",
    },
  ];

  const additionalStats = [
    { label: "총 XP", value: stats?.totalXp.toLocaleString() ?? "0", color: "text-indigo-400" },
    { label: "평균 레벨", value: `Lv. ${stats?.avgLevel ?? 0}`, color: "text-green-400" },
    { label: "최고 레벨", value: `Lv. ${stats?.maxLevel ?? 0}`, color: "text-amber-400" },
  ];

  const quickActions = [
    {
      title: "XP 설정",
      description: "텍스트 및 음성 XP 설정 관리",
      href: `/dashboard/${guildId}/xp/settings`,
      icon: "solar:bolt-linear",
      color: "from-yellow-500 to-amber-500",
    },
    {
      title: "레벨 보상",
      description: "레벨업 시 지급할 역할 설정",
      href: `/dashboard/${guildId}/xp/rewards`,
      icon: "solar:cup-star-linear",
      color: "from-purple-500 to-pink-500",
    },
    {
      title: "통계",
      description: "서버 활동 및 XP 통계 확인",
      href: `/dashboard/${guildId}/xp/stats`,
      icon: "solar:chart-2-linear",
      color: "from-blue-500 to-cyan-500",
    },
    {
      title: "멤버 관리",
      description: "서버 멤버 XP 및 레벨 관리",
      href: `/dashboard/${guildId}/members`,
      icon: "solar:users-group-rounded-linear",
      color: "from-green-500 to-emerald-500",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="animate-fade-up">
        <h1 className="text-2xl md:text-3xl font-bold text-white">대시보드</h1>
        <p className="text-white/50 mt-1">
          {guild?.name ?? "서버"} 관리 대시보드
        </p>
      </div>

      {/* Main Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {mainStats.map((stat, index) => (
          <div
            key={stat.label}
            className="group relative bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300 animate-fade-up"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Background gradient on hover */}
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-300`} />

            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white/50 text-sm">{stat.label}</span>
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                  <Icon icon={stat.icon} className="w-4 h-4 text-white" />
                </div>
              </div>

              {stat.isStatus ? (
                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
                  stat.isActive
                    ? "bg-green-500/20 text-green-400"
                    : "bg-white/10 text-white/50"
                }`}>
                  <Icon
                    icon={stat.isActive ? "solar:check-circle-linear" : "solar:close-circle-linear"}
                    className="w-4 h-4"
                  />
                  {stat.value}
                </span>
              ) : (
                <>
                  <p className="text-3xl font-bold text-white">{stat.value}</p>
                  {stat.subValue && (
                    <p className="text-sm text-white/40 mt-1">{stat.subValue}</p>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Additional Stats */}
      {stats && stats.totalMembers > 0 && (
        <div className="grid gap-4 sm:grid-cols-3 animate-fade-up" style={{ animationDelay: "200ms" }}>
          {additionalStats.map((stat) => (
            <div key={stat.label} className="bg-white/5 rounded-2xl p-5 border border-white/10">
              <p className="text-white/50 text-sm mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="animate-fade-up" style={{ animationDelay: "250ms" }}>
        <h2 className="text-lg font-semibold text-white mb-4">빠른 설정</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action, index) => (
            <Link key={action.title} href={action.href}>
              <div className="group relative h-full bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/10 hover:border-indigo-500/30 transition-all duration-300">
                {/* Hover Glow */}
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 to-purple-500/0 group-hover:from-indigo-500/5 group-hover:to-purple-500/5 rounded-2xl transition-all duration-300" />

                <div className="relative">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <Icon icon={action.icon} className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors mb-1">
                    {action.title}
                  </h3>
                  <p className="text-white/40 text-sm">{action.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Bot Status Warning */}
      {!guild?.botJoined && (
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-600/20 to-orange-600/20 backdrop-blur-sm rounded-2xl border border-amber-500/30 p-6 animate-fade-up" style={{ animationDelay: "300ms" }}>
          {/* Background Glow */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/20 rounded-full blur-3xl" />

          <div className="relative flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <Icon icon="solar:danger-triangle-linear" className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-400">봇이 서버에 없습니다</h3>
                <p className="text-white/50 text-sm">
                  봇을 서버에 초대해야 모든 기능을 사용할 수 있습니다
                </p>
              </div>
            </div>
            <Button
              asChild
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-lg shadow-amber-500/25"
            >
              <a href={getBotInviteUrl(guildId)} target="_blank" rel="noopener noreferrer">
                <DiscordIcon className="w-5 h-5 mr-2" />
                봇 초대하기
                <Icon icon="solar:arrow-right-up-linear" className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
