import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";

export interface Wallet {
  userId: string;
  topyBalance: string;
  topyTotalEarned: string;
  rubyBalance: string;
  rubyTotalEarned: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalletsResponse {
  wallets: Wallet[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  balance: string;
  totalEarned: string;
}

export interface LeaderboardResponse {
  type: "topy" | "ruby";
  leaderboard: LeaderboardEntry[];
}

export function useCurrencyWallets(
  guildId: string,
  page: number = 1,
  limit: number = 20,
  search?: string
) {
  return useQuery({
    queryKey: ["currency-wallets", guildId, page, limit, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) {
        params.set("search", search);
      }
      const response = await apiClient.get<WalletsResponse>(
        `/api/guilds/${guildId}/currency/wallets?${params.toString()}`
      );
      return response.data;
    },
    enabled: !!guildId,
  });
}

export function useCurrencyLeaderboard(
  guildId: string,
  type: "topy" | "ruby" = "topy",
  limit: number = 10
) {
  return useQuery({
    queryKey: ["currency-leaderboard", guildId, type, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        type,
        limit: limit.toString(),
      });
      const response = await apiClient.get<LeaderboardResponse>(
        `/api/guilds/${guildId}/currency/leaderboard?${params.toString()}`
      );
      return response.data;
    },
    enabled: !!guildId,
  });
}
