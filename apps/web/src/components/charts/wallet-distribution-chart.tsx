"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import type { WalletDistributionItem } from "@/hooks/queries/use-wallet-distribution";

interface WalletDistributionChartProps {
  data: WalletDistributionItem[];
  top10Percent: number;
  isLoading?: boolean;
  currencyName?: string;
}

const BAR_COLORS = [
  "#64748b", // 0
  "#22c55e", // 1-1K
  "#3b82f6", // 1K-5K
  "#8b5cf6", // 5K-10K
  "#f59e0b", // 10K-50K
  "#f97316", // 50K-100K
  "#ef4444", // 100K+
];

export function WalletDistributionChart({
  data,
  top10Percent,
  isLoading,
  currencyName = "토피",
}: WalletDistributionChartProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

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

  const totalWallets = data.reduce((sum, d) => sum + d.count, 0);

  if (totalWallets === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[140px] text-white/40">
        <p className="text-sm">지갑 데이터가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2}>
            <XAxis
              dataKey="range"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }}
              interval={0}
            />
            <YAxis hide domain={[0, maxCount * 1.1]} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const count = payload[0]?.value as number;
                  const percent = totalWallets > 0 ? ((count / totalWallets) * 100).toFixed(1) : 0;
                  return (
                    <div className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm">
                      <p className="text-white font-medium">{label} {currencyName}</p>
                      <p className="text-white/60">{count.toLocaleString()}명 ({percent}%)</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={28}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/40">총 {totalWallets.toLocaleString()}개 지갑</span>
        <span className="text-white/60">
          상위 10%가 <span className="text-amber-400 font-medium">{top10Percent}%</span> 보유
        </span>
      </div>
    </div>
  );
}
