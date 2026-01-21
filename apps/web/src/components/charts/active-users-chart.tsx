"use client";

interface ActiveUsersChartProps {
  totalMembers: number;
  membersWithXp: number;
  todayTextActive: number;
  todayVoiceActive: number;
  isLoading?: boolean;
}

export function ActiveUsersChart({
  totalMembers,
  membersWithXp,
  todayTextActive,
  todayVoiceActive,
  isLoading,
}: ActiveUsersChartProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[160px]">
        <div className="w-32 h-32 rounded-full bg-white/5 animate-pulse" />
      </div>
    );
  }

  const activePercent = totalMembers > 0 ? Math.round((membersWithXp / totalMembers) * 100) : 0;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (activePercent / 100) * circumference;

  return (
    <div className="flex items-center gap-6">
      {/* 원형 게이지 */}
      <div className="relative w-[120px] h-[120px]">
        <svg className="w-full h-full -rotate-90">
          {/* 배경 원 */}
          <circle
            cx="60"
            cy="60"
            r="45"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="10"
          />
          {/* 진행 원 */}
          <circle
            cx="60"
            cy="60"
            r="45"
            fill="none"
            stroke="url(#activeGradient)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500"
          />
          <defs>
            <linearGradient id="activeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
        </svg>
        {/* 중앙 텍스트 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{activePercent}%</span>
          <span className="text-[10px] text-white/40">참여율</span>
        </div>
      </div>

      {/* 상세 통계 */}
      <div className="flex-1 space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-white/50">XP 보유 멤버</span>
            <span className="text-white">{membersWithXp.toLocaleString()}명</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-full"
              style={{ width: `${activePercent}%` }}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-white/5 rounded-lg p-2">
            <p className="text-white/40 mb-0.5">오늘 텍스트</p>
            <p className="text-green-400 font-semibold">{todayTextActive}명</p>
          </div>
          <div className="bg-white/5 rounded-lg p-2">
            <p className="text-white/40 mb-0.5">오늘 음성</p>
            <p className="text-purple-400 font-semibold">{todayVoiceActive}명</p>
          </div>
        </div>
      </div>
    </div>
  );
}
