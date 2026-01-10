// Discord Bot Client ID (same as OAuth app)
const BOT_CLIENT_ID = process.env["NEXT_PUBLIC_DISCORD_CLIENT_ID"] || "1450932450464108755";

// Bot permissions - Administrator (8)
// 모든 기능(채널 관리, 역할 관리, 메시지 등)을 위해 관리자 권한 사용
const BOT_PERMISSIONS = "8";

/**
 * Generate Discord bot invite URL
 * @param guildId - Optional guild ID to pre-select the server
 */
export function getBotInviteUrl(guildId?: string): string {
  const params = new URLSearchParams({
    client_id: BOT_CLIENT_ID,
    permissions: BOT_PERMISSIONS,
    scope: "bot applications.commands",
  });

  if (guildId) {
    params.append("guild_id", guildId);
  }

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}
