"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import type { XpDailyTrendItem } from "@/hooks/queries/use-xp-daily-trend";

interface XpDailyTrendChartProps {
  data: XpDailyTrendItem[];
  isLoading?: boolean;
}

export function XpDailyTrendChart({
  data,
  isLoading,
}: XpDailyTrendChartProps) {
  const maxValue = Math.max(
    ...data.map((d) => Math.max(d.textActive, d.voiceActive)),
    1
  );

  const skeletonHeights = [60, 80, 45, 70, 55, 85, 65];

  if (isLoading) {
    return (
      <div className="flex items-end justify-between gap-2 h-[140px] px-2">
        {skeletonHeights.map((height, i) => (
          <div
            key={i}
            className="flex-1 bg-white/5 rounded-t animate-pulse"
            style={{ height: `${height}%` }}
          />
        ))}
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

  return (
    <div className="space-y-2">
      <div className="h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2}>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
            />
            <YAxis hide domain={[0, maxValue * 1.1]} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const text = payload[0]?.value as number;
                  const voice = payload[1]?.value as number;
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
            <Bar dataKey="textActive" radius={[4, 4, 0, 0]} maxBarSize={20}>
              {data.map((_, index) => (
                <Cell key={`text-${index}`} fill="#22c55e" fillOpacity={0.8} />
              ))}
            </Bar>
            <Bar dataKey="voiceActive" radius={[4, 4, 0, 0]} maxBarSize={20}>
              {data.map((_, index) => (
                <Cell key={`voice-${index}`} fill="#a855f7" fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="text-white/60">텍스트</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
          <span className="text-white/60">음성</span>
        </div>
      </div>
    </div>
  );
}
