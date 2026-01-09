"use client";

import { useMemo } from "react";
import type { HeatmapCell } from "@/hooks/queries/use-activity-heatmap";

interface SidebarHeatmapProps {
  cells: HeatmapCell[];
  maxCount: number;
  isLoading?: boolean;
}

// 요일 순서: 월, 화, 수, 목, 금, 토, 일
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
// API에서 오는 day 값 (0=일, 1=월, ..., 6=토)을 변환
const DAY_INDEX_MAP = [1, 2, 3, 4, 5, 6, 0]; // 월(1), 화(2), ..., 일(0)

const HOURS = Array.from({ length: 24 }, (_, i) => i);

// 퍼센트에 따른 배경색 (디코올 스타일)
function getCellColor(percent: number): string {
  if (percent === 0) return "bg-slate-800/50";
  if (percent < 20) return "bg-emerald-900/60";
  if (percent < 40) return "bg-emerald-800/70";
  if (percent < 60) return "bg-emerald-700/80";
  if (percent < 80) return "bg-emerald-600/90";
  return "bg-emerald-500";
}

export function SidebarHeatmap({
  cells,
  maxCount,
  isLoading,
}: SidebarHeatmapProps) {
  // 셀 데이터를 day×hour 맵으로 변환
  const cellMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const cell of cells) {
      map.set(`${cell.day}-${cell.hour}`, cell.count);
    }
    return map;
  }, [cells]);

  // 퍼센트 계산 (최대값 대비)
  const getPercent = (apiDayIndex: number, hour: number): number => {
    const count = cellMap.get(`${apiDayIndex}-${hour}`) || 0;
    if (maxCount === 0) return 0;
    return Math.round((count / maxCount) * 100);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded bg-slate-700" />
        <div className="h-32 animate-pulse rounded bg-slate-700/50" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-white/60">활동 시간대</p>
      <div className="overflow-hidden rounded-lg bg-slate-900/50 p-2">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="w-5" />
              {DAYS.map((day) => (
                <th key={day} className="text-[8px] text-white/40 font-normal p-0.5">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((hour) => (
              <tr key={hour}>
                <td className="text-[8px] text-white/30 pr-1 text-right">
                  {hour.toString().padStart(2, "0")}
                </td>
                {DAY_INDEX_MAP.map((apiDayIndex, displayIndex) => {
                  const percent = getPercent(apiDayIndex, hour);
                  const bgClass = getCellColor(percent);
                  return (
                    <td
                      key={`${displayIndex}-${hour}`}
                      className={`p-0`}
                      title={`${DAYS[displayIndex]} ${hour}시: ${percent}%`}
                    >
                      <div className={`w-full aspect-square ${bgClass} rounded-[1px]`} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
