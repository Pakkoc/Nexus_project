"use client";

import { Icon } from "@iconify/react";
import type { PopularItem } from "@/hooks/queries/use-shop-stats";

interface PopularItemsChartProps {
  items: PopularItem[];
  isLoading?: boolean;
  currencyName?: string;
}

const RANK_COLORS = [
  "from-yellow-500 to-amber-500",
  "from-slate-400 to-slate-500",
  "from-orange-600 to-orange-700",
  "from-slate-500 to-slate-600",
  "from-slate-500 to-slate-600",
];

const RANK_ICONS = ["🥇", "🥈", "🥉", "4", "5"];

export function PopularItemsChart({
  items,
  isLoading,
  currencyName = "토피",
}: PopularItemsChartProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="w-6 h-6 rounded-full bg-white/10" />
            <div className="flex-1 h-4 bg-white/5 rounded" />
            <div className="w-12 h-4 bg-white/5 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[160px] text-white/40">
        <Icon icon="solar:bag-4-linear" className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">판매 데이터가 없습니다</p>
      </div>
    );
  }

  const maxCount = Math.max(...items.map((i) => i.purchaseCount), 1);

  return (
    <div className="space-y-2.5">
      {items.map((item, index) => {
        const barWidth = (item.purchaseCount / maxCount) * 100;
        return (
          <div key={item.id} className="flex items-center gap-2">
            <div className="w-6 text-center text-sm">
              {index < 3 ? RANK_ICONS[index] : <span className="text-white/40">{index + 1}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-white truncate">{item.name}</span>
                <span className="text-xs text-white/50 ml-2">{item.purchaseCount}회</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${RANK_COLORS[index]} rounded-full transition-all`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
