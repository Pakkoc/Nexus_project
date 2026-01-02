import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";

export interface LeftMember {
  userId: string;
  leftAt: string;
  expiresAt: string;
}

export interface DataRetentionSettings {
  guildId: string;
  retentionDays: number;
  leftMembers: LeftMember[];
}

export interface UpdateDataRetentionSettings {
  retentionDays: number;
}

export function useDataRetentionSettings(guildId: string) {
  return useQuery({
    queryKey: ["data-retention", guildId],
    queryFn: async () => {
      const response = await apiClient.get<DataRetentionSettings>(
        `/api/guilds/${guildId}/settings/data-retention`
      );
      return response.data;
    },
    enabled: !!guildId,
  });
}

export function useUpdateDataRetentionSettings(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateDataRetentionSettings) => {
      const response = await apiClient.patch<DataRetentionSettings>(
        `/api/guilds/${guildId}/settings/data-retention`,
        data
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["data-retention", guildId], data);
    },
  });
}
