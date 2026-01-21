"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";

export interface MemberTrendItem {
  date: string;
  label: string;
  totalMembers: number;
  newMembers: number;
}

export interface MemberTrendData {
  dailyTrend: MemberTrendItem[];
  totalNewMembers: number;
  avgDailyNew: number;
  currentTotal: number;
  period: string;
}

export function useMemberTrend(guildId: string, period: "monthly" | "yearly" = "monthly") {
  return useQuery<MemberTrendData>({
    queryKey: ["member-trend", guildId, period],
    queryFn: async () => {
      const res = await apiClient.get<MemberTrendData>(
        `/api/guilds/${guildId}/stats/member-trend?period=${period}`
      );
      return res.data;
    },
    enabled: !!guildId,
  });
}
