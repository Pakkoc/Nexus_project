import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";
import { ChannelCategoryConfig, CreateChannelCategory } from "@/types/currency";

export function useChannelCategories(guildId: string) {
  return useQuery({
    queryKey: ["channel-categories", guildId],
    queryFn: async () => {
      const response = await apiClient.get<ChannelCategoryConfig[]>(
        `/api/guilds/${guildId}/currency/channel-categories`
      );
      return response.data;
    },
    enabled: !!guildId,
  });
}

export function useCreateChannelCategory(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateChannelCategory) => {
      const response = await apiClient.post<ChannelCategoryConfig>(
        `/api/guilds/${guildId}/currency/channel-categories`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channel-categories", guildId] });
    },
  });
}

export function useDeleteChannelCategory(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/guilds/${guildId}/currency/channel-categories?id=${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channel-categories", guildId] });
    },
  });
}
