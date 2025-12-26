import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";

export interface CurrencyManager {
  id: number;
  guildId: string;
  userId: string;
  createdAt: string;
}

export function useCurrencyManagers(guildId: string) {
  return useQuery({
    queryKey: ["currency-managers", guildId],
    queryFn: async () => {
      const response = await apiClient.get<CurrencyManager[]>(
        `/api/guilds/${guildId}/currency/managers`
      );
      return response.data;
    },
    enabled: !!guildId,
  });
}

export function useAddCurrencyManager(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiClient.post<CurrencyManager>(
        `/api/guilds/${guildId}/currency/managers`,
        { userId }
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
    mutationFn: async (userId: string) => {
      await apiClient.delete(`/api/guilds/${guildId}/currency/managers`, {
        data: { userId },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["currency-managers", guildId],
      });
    },
  });
}
