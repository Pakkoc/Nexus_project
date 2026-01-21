"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";

export interface PopularItem {
  rank: number;
  id: number;
  name: string;
  type: string;
  purchaseCount: number;
  totalRevenue: number;
}

export interface ShopStatsData {
  popularItems: PopularItem[];
  period: string;
}

export function useShopStats(guildId: string) {
  return useQuery<ShopStatsData>({
    queryKey: ["shop-stats", guildId],
    queryFn: async () => {
      const res = await apiClient.get<ShopStatsData>(
        `/api/guilds/${guildId}/shop-v2/stats`
      );
      return res.data;
    },
    enabled: !!guildId,
  });
}
