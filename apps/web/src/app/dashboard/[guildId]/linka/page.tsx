"use client";

import { useParams } from "next/navigation";
import { NavigationLink } from "@/components/navigation-link";
import { Icon } from "@iconify/react";

export default function LinkaPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      {/* Back Button */}
      <NavigationLink
        href={`/dashboard/${guildId}`}
        className="absolute top-8 left-8 inline-flex items-center gap-2 text-white/50 hover:text-white/80 text-sm transition-colors"
      >
        <Icon icon="solar:arrow-left-linear" className="w-4 h-4" />
        대시보드로 돌아가기
      </NavigationLink>

      {/* Logo */}
      <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mb-8 animate-fade-up">
        <img src="/logo/linka_logo.png" alt="LINKA" className="w-24 h-24 object-contain" />
      </div>

      {/* Title */}
      <h1 className="text-4xl font-bold text-white mb-2 animate-fade-up" style={{ animationDelay: "100ms" }}>
        LINKA
      </h1>

      {/* Subtitle */}
      <p className="text-lg font-medium bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent mb-4 animate-fade-up" style={{ animationDelay: "150ms" }}>
        스마트한 관리
      </p>

      {/* Description */}
      <p className="text-white/50 max-w-md mb-8 animate-fade-up" style={{ animationDelay: "200ms" }}>
        관리자 실적, 권한 부여, 운영 로그...
        <br />
        흩어진 관리 기능을 하나로 묶어 운영진의 피로도를 0으로 만듭니다.
      </p>

      {/* Coming Soon Badge */}
      <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 border border-white/10 animate-fade-up" style={{ animationDelay: "250ms" }}>
        <Icon icon="solar:clock-circle-linear" className="w-5 h-5 text-white/50" />
        <span className="text-white/70 font-medium">곧 출시됩니다</span>
      </div>
    </div>
  );
}
