import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";
import { CreateXpMultiplier, UpdateXpMultiplier, XpMultiplier } from "@/types/xp";

export function useXpMultipliers(guildId: string) {
  return useQuery({
    queryKey: ["xp-multipliers", guildId],
    queryFn: async () => {
      const response = await apiClient.get<XpMultiplier[]>(
        `/api/guilds/${guildId}/xp/multipliers`
      );
      return response.data;
    },
    enabled: !!guildId,
  });
}

export function useCreateXpMultiplier(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateXpMultiplier) => {
      const response = await apiClient.post<XpMultiplier>(
        `/api/guilds/${guildId}/xp/multipliers`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["xp-multipliers", guildId] });
    },
  });
}

export function useUpdateXpMultiplier(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateXpMultiplier }) => {
      const response = await apiClient.patch(
        `/api/guilds/${guildId}/xp/multipliers?id=${id}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["xp-multipliers", guildId] });
    },
  });
}

export function useDeleteXpMultiplier(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/guilds/${guildId}/xp/multipliers?id=${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["xp-multipliers", guildId] });
    },
  });
}
