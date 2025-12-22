import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";
import { CurrencySettings, UpdateCurrencySettings } from "@/types/currency";

export function useCurrencySettings(guildId: string) {
  return useQuery({
    queryKey: ["currency-settings", guildId],
    queryFn: async () => {
      const response = await apiClient.get<CurrencySettings>(
        `/api/guilds/${guildId}/currency/settings`
      );
      return response.data;
    },
    enabled: !!guildId,
  });
}

export function useUpdateCurrencySettings(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateCurrencySettings) => {
      const response = await apiClient.patch<CurrencySettings>(
        `/api/guilds/${guildId}/currency/settings`,
        data
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["currency-settings", guildId], data);
    },
  });
}
