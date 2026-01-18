/**
 * 국고 엔티티
 */
export interface GuildTreasury {
  guildId: string;
  topyBalance: bigint;
  rubyBalance: bigint;
  totalTopyCollected: bigint;
  totalRubyCollected: bigint;
  totalTopyDistributed: bigint;
  totalRubyDistributed: bigint;
  createdAt: Date;
  updatedAt: Date;
}

export function createGuildTreasury(guildId: string, now: Date): GuildTreasury {
  return {
    guildId,
    topyBalance: BigInt(0),
    rubyBalance: BigInt(0),
    totalTopyCollected: BigInt(0),
    totalRubyCollected: BigInt(0),
    totalTopyDistributed: BigInt(0),
    totalRubyDistributed: BigInt(0),
    createdAt: now,
    updatedAt: now,
  };
}
