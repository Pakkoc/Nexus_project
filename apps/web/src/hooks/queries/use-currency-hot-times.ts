import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";
import { CurrencyHotTime, CreateCurrencyHotTime } from "@/types/currency";

export function useCurrencyHotTimes(guildId: string) {
  return useQuery({
    queryKey: ["currency-hot-times", guildId],
    queryFn: async () => {
      const response = await apiClient.get<CurrencyHotTime[]>(
        `/api/guilds/${guildId}/currency/hot-times`
      );
      return response.data;
    },
    enabled: !!guildId,
  });
}

export function useCreateCurrencyHotTime(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCurrencyHotTime) => {
      const response = await apiClient.post<CurrencyHotTime>(
        `/api/guilds/${guildId}/currency/hot-times`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currency-hot-times", guildId] });
    },
  });
}

export function useDeleteCurrencyHotTime(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/guilds/${guildId}/currency/hot-times?id=${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currency-hot-times", guildId] });
    },
  });
}
