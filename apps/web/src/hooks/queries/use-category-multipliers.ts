import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";
import { CategoryMultiplierConfig, SaveCategoryMultiplier } from "@/types/currency";

export function useCategoryMultipliers(guildId: string) {
  return useQuery({
    queryKey: ["category-multipliers", guildId],
    queryFn: async () => {
      const response = await apiClient.get<CategoryMultiplierConfig[]>(
        `/api/guilds/${guildId}/currency/category-multipliers`
      );
      return response.data;
    },
    enabled: !!guildId,
  });
}

export function useSaveCategoryMultiplier(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SaveCategoryMultiplier) => {
      const response = await apiClient.post<{ success: boolean }>(
        `/api/guilds/${guildId}/currency/category-multipliers`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-multipliers", guildId] });
    },
  });
}

export function useResetCategoryMultiplier(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (category: string) => {
      await apiClient.delete(
        `/api/guilds/${guildId}/currency/category-multipliers?category=${category}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-multipliers", guildId] });
    },
  });
}
