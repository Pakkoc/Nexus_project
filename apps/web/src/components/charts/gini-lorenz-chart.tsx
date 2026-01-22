"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
} from "recharts";

interface LorenzPoint {
  x: number;
  y: number;
}

interface GiniLorenzChartProps {
  lorenzCurve: LorenzPoint[];
  giniCoefficient: number;
  bottom80Percent: number;
  isLoading?: boolean;
}

export function GiniLorenzChart({
  lorenzCurve,
  giniCoefficient,
  bottom80Percent,
  isLoading,
}: GiniLorenzChartProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-[200px] bg-white/5 rounded-xl animate-pulse" />
        <div className="flex justify-between">
          <div className="h-4 w-24 bg-white/5 rounded animate-pulse" />
          <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // 완전균등선 데이터 (대각선)
  const equalityLine = Array.from({ length: 11 }, (_, i) => ({
    x: i * 10,
    equality: i * 10,
  }));

  // 로렌츠 곡선과 균등선 병합
  const chartData = equalityLine.map((point) => {
    const lorenzPoint = lorenzCurve.find((p) => p.x === point.x);
    return {
      x: point.x,
      equality: point.equality,
      lorenz: lorenzPoint?.y ?? point.x,
    };
  });

  // 지니계수에 따른 상태 판정
  const getGiniStatus = (gini: number) => {
    if (gini < 0.3) return { label: "평등", color: "text-green-400", bgColor: "from-green-500 to-emerald-500" };
    if (gini < 0.4) return { label: "보통", color: "text-yellow-400", bgColor: "from-yellow-500 to-amber-500" };
    if (gini < 0.5) return { label: "불평등", color: "text-orange-400", bgColor: "from-orange-500 to-red-500" };
    return { label: "위험", color: "text-red-400", bgColor: "from-red-500 to-rose-500" };
  };

  const status = getGiniStatus(giniCoefficient);

  return (
    <div className="space-y-4">
      {/* 차트 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-white/70">국가 불평등 지수</h4>
          <p className="text-xs text-white/40">Gini Coefficient</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{giniCoefficient.toFixed(2)}</p>
          <p className={`text-xs font-medium ${status.color}`}>{status.label}</p>
        </div>
      </div>

      {/* 로렌츠 곡선 차트 */}
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="lorenzGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="inequalityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="x"
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
              tickFormatter={(value) => `${value}%`}
              ticks={[0, 20, 40, 60, 80, 100]}
            />
            <YAxis
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
              tickFormatter={(value) => `${value}%`}
              ticks={[0, 20, 40, 60, 80, 100]}
              domain={[0, 100]}
            />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.2)" }}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const lorenz = payload.find((p) => p.dataKey === "lorenz")?.value as number;
                  const equality = payload.find((p) => p.dataKey === "equality")?.value as number;
                  return (
                    <div className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm">
                      <p className="text-white/60 mb-1">하위 {label}% 인구</p>
                      <p className="text-green-400">완전균등: {equality}% 보유</p>
                      <p className="text-white">실제 분포: {lorenz?.toFixed(1)}% 보유</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            {/* 80% 기준선 */}
            <ReferenceLine
              x={80}
              stroke="rgba(255,255,255,0.2)"
              strokeDasharray="3 3"
            />
            {/* 완전균등선 (대각선) */}
            <Area
              type="linear"
              dataKey="equality"
              stroke="#22c55e"
              strokeWidth={2}
              strokeDasharray="5 5"
              fill="url(#lorenzGradient)"
              fillOpacity={0}
            />
            {/* 로렌츠 곡선 */}
            <Area
              type="monotone"
              dataKey="lorenz"
              stroke="#ffffff"
              strokeWidth={2}
              fill="url(#inequalityGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 범례 */}
      <div className="flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-5 h-0.5 bg-green-500 border-dashed" style={{ borderTopWidth: 2, borderTopStyle: "dashed", backgroundColor: "transparent", borderColor: "#22c55e" }} />
          <span className="text-white/50">완전균등선</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-0.5 bg-white" />
          <span className="text-white/50">실제 분포</span>
        </div>
      </div>

      {/* 하단 정보 */}
      <div className="bg-white/5 rounded-xl p-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-white/50">📊</span>
          <span className="text-white/70">
            하위 <span className="text-amber-400 font-medium">80%</span> 유저가 전체{" "}
            <span className="text-amber-400 font-medium">{bottom80Percent}%</span>의 재화를 보유
          </span>
        </div>
      </div>

      {/* 경고 메시지 (지니계수 높을 때) */}
      {giniCoefficient >= 0.5 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-red-400">⚠️</span>
            <span className="text-red-300">
              [위기] 자산 불평등 상태입니다. 재분배 정책을 고려하세요.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
