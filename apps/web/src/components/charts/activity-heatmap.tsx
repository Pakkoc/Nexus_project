"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { HeatmapCell } from "@/hooks/queries/use-activity-heatmap";

interface ActivityHeatmapProps {
  cells: HeatmapCell[];
  maxCount: number;
  totalActivities: number;
  isLoading?: boolean;
}

// 요일 순서: 월, 화, 수, 목, 금, 토, 일
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
// API에서 오는 day 값 (0=일, 1=월, ..., 6=토)을 변환
const DAY_INDEX_MAP = [1, 2, 3, 4, 5, 6, 0]; // 월(1), 화(2), ..., 일(0)

const HOURS = Array.from({ length: 24 }, (_, i) => i);

// 퍼센트에 따른 배경색 (디코올 스타일)
function getCellStyle(percent: number): string {
  if (percent === 0) return "bg-slate-800/50";
  if (percent < 20) return "bg-emerald-900/40";
  if (percent < 40) return "bg-emerald-800/50";
  if (percent < 60) return "bg-emerald-700/60";
  if (percent < 80) return "bg-emerald-600/70";
  return "bg-emerald-500/80";
}

// 퍼센트에 따른 텍스트 색상
function getTextColor(percent: number): string {
  if (percent === 0) return "text-slate-600";
  if (percent < 40) return "text-emerald-400/70";
  return "text-emerald-300";
}

export function ActivityHeatmap({
  cells,
  maxCount,
  totalActivities,
  isLoading,
}: ActivityHeatmapProps) {
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
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader className="pb-2">
          <div className="h-5 w-40 animate-pulse rounded bg-slate-700" />
        </CardHeader>
        <CardContent>
          <div className="h-[500px] animate-pulse rounded bg-slate-700/50" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-700 bg-slate-800/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-white">
          서버 인원 활동 시간대
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="p-1 text-slate-400 font-normal text-left w-12">시간</th>
                {DAYS.map((day) => (
                  <th key={day} className="p-1 text-slate-400 font-normal text-center w-12">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOURS.map((hour) => (
                <tr key={hour}>
                  <td className="p-1 text-slate-500 text-left">
                    {hour.toString().padStart(2, "0")}
                  </td>
                  {DAY_INDEX_MAP.map((apiDayIndex, displayIndex) => {
                    const percent = getPercent(apiDayIndex, hour);
                    const bgClass = getCellStyle(percent);
                    const textClass = getTextColor(percent);
                    return (
                      <td
                        key={`${displayIndex}-${hour}`}
                        className={`p-1 text-center ${bgClass} border border-slate-700/30`}
                      >
                        <span className={`${textClass} text-[10px]`}>
                          {percent > 0 ? `${percent}%` : ""}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalActivities === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-slate-500">
            <p className="text-sm">아직 활동 데이터가 없습니다</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
