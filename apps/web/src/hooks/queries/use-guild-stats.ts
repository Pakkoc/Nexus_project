import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface GuildStats {
  totalMembers: number;
  membersWithXp: number;
  totalTextXp: number;
  totalVoiceXp: number;
  totalXp: number;
  avgTextLevel: number;
  avgVoiceLevel: number;
  maxTextLevel: number;
  maxVoiceLevel: number;
  avgTextXpPerMember: number;
  avgVoiceXpPerMember: number;
  avgTextLevelExcludeZero: number;
  avgVoiceLevelExcludeZero: number;
  xpEnabled: boolean;
  textXpEnabled: boolean;
  voiceXpEnabled: boolean;
  todayTextActive: number;
  todayVoiceActive: number;
  topUsers: {
    userId: string;
    textXp: number;
    voiceXp: number;
    totalXp: number;
    textLevel: number;
    voiceLevel: number;
  }[];
}

export function useGuildStats(guildId: string) {
  return useQuery({
    queryKey: ["guild-stats", guildId],
    queryFn: async () => {
      const { data } = await axios.get<GuildStats>(
        `/api/guilds/${guildId}/stats`
      );
      return data;
    },
    enabled: !!guildId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}
