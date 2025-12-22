import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";
import { CurrencyExclusion, CreateCurrencyExclusion } from "@/types/currency";

export function useCurrencyExclusions(guildId: string) {
  return useQuery({
    queryKey: ["currency-exclusions", guildId],
    queryFn: async () => {
      const response = await apiClient.get<CurrencyExclusion[]>(
        `/api/guilds/${guildId}/currency/exclusions`
      );
      return response.data;
    },
    enabled: !!guildId,
  });
}

export function useCreateCurrencyExclusion(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCurrencyExclusion) => {
      const response = await apiClient.post<CurrencyExclusion>(
        `/api/guilds/${guildId}/currency/exclusions`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currency-exclusions", guildId] });
    },
  });
}

export function useDeleteCurrencyExclusion(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/guilds/${guildId}/currency/exclusions?id=${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currency-exclusions", guildId] });
    },
  });
}
