"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { XpDailyTrendItem } from "@/hooks/queries/use-xp-daily-trend";

interface XpDailyTrendChartProps {
  data: XpDailyTrendItem[];
  isLoading?: boolean;
}

export function XpDailyTrendChart({
  data,
  isLoading,
}: XpDailyTrendChartProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-[140px] bg-white/5 rounded animate-pulse" />
      </div>
    );
  }

  const hasData = data.some((d) => d.textActive > 0 || d.voiceActive > 0);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-[140px] text-white/40">
        <p className="text-sm">활동 데이터가 없습니다</p>
      </div>
    );
  }

  const maxValue = Math.max(
    ...data.map((d) => Math.max(d.textActive, d.voiceActive)),
    1
  );

  return (
    <div className="space-y-2">
      {/* 범례 */}
      <div className="flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-green-400 rounded-full" />
          <span className="text-white/60">텍스트</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-purple-400 rounded-full" />
          <span className="text-white/60">음성</span>
        </div>
      </div>

      <div className="h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.1)"
              vertical={true}
              horizontal={true}
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
              domain={[0, Math.ceil(maxValue * 1.2)]}
              tickCount={4}
              width={30}
            />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.1)" }}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const text = payload.find(p => p.dataKey === "textActive")?.value as number;
                  const voice = payload.find(p => p.dataKey === "voiceActive")?.value as number;
                  return (
                    <div className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm">
                      <p className="text-white font-medium mb-1">{label}</p>
                      <p className="text-green-400">텍스트: {text?.toLocaleString()}명</p>
                      <p className="text-purple-400">음성: {voice?.toLocaleString()}명</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey="textActive"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
              activeDot={{ fill: "#22c55e", strokeWidth: 2, stroke: "#fff", r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="voiceActive"
              stroke="#a855f7"
              strokeWidth={2}
              dot={false}
              activeDot={{ fill: "#a855f7", strokeWidth: 2, stroke: "#fff", r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
