import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";
import type { CurrencyType } from "./use-currency-transactions";

export interface CurrencyManager {
  id: number;
  guildId: string;
  userId: string;
  currencyType: CurrencyType;
  createdAt: string;
}

export function useCurrencyManagers(guildId: string, currencyType?: CurrencyType) {
  return useQuery({
    queryKey: ["currency-managers", guildId, currencyType],
    queryFn: async () => {
      const url = currencyType
        ? `/api/guilds/${guildId}/currency/managers?type=${currencyType}`
        : `/api/guilds/${guildId}/currency/managers`;
      const response = await apiClient.get<CurrencyManager[]>(url);
      return response.data;
    },
    enabled: !!guildId,
  });
}

export function useAddCurrencyManager(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, currencyType }: { userId: string; currencyType: CurrencyType }) => {
      const response = await apiClient.post<CurrencyManager>(
        `/api/guilds/${guildId}/currency/managers`,
        { userId, currencyType }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["currency-managers", guildId],
      });
    },
  });
}

export function useRemoveCurrencyManager(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, currencyType }: { userId: string; currencyType: CurrencyType }) => {
      await apiClient.delete(`/api/guilds/${guildId}/currency/managers`, {
        data: { userId, currencyType },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["currency-managers", guildId],
      });
    },
  });
}
