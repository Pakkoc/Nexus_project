"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";

export interface XpDailyTrendItem {
  date: string;
  label: string;
  textActive: number;
  voiceActive: number;
}

export interface XpDailyTrendData {
  dailyTrend: XpDailyTrendItem[];
  totalTextActive: number;
  totalVoiceActive: number;
  period: string;
}

export function useXpDailyTrend(guildId: string) {
  return useQuery<XpDailyTrendData>({
    queryKey: ["xp-daily-trend", guildId],
    queryFn: async () => {
      const res = await apiClient.get<XpDailyTrendData>(
        `/api/guilds/${guildId}/xp/daily-trend`
      );
      return res.data;
    },
    enabled: !!guildId,
  });
}
