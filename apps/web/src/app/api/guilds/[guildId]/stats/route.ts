import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

interface StatsRow extends RowDataPacket {
  total_members: number;
  total_text_xp: number;
  total_voice_xp: number;
  avg_text_level: number;
  avg_voice_level: number;
  max_text_level: number;
  max_voice_level: number;
  avg_text_xp_per_member: number;
  avg_voice_xp_per_member: number;
  avg_text_level_exclude_zero: number;
  avg_voice_level_exclude_zero: number;
}

interface SettingsRow extends RowDataPacket {
  enabled: boolean;
  text_xp_enabled: boolean;
  voice_xp_enabled: boolean;
}

interface DiscordGuild {
  id: string;
  name: string;
  approximate_member_count?: number;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId } = await params;

  try {
    const pool = db();

    // Get actual guild member count from Discord API
    let totalMembers = 0;
    const botToken = process.env.DISCORD_TOKEN;
    if (botToken) {
      try {
        const guildRes = await fetch(
          `https://discord.com/api/v10/guilds/${guildId}?with_counts=true`,
          {
            headers: { Authorization: `Bot ${botToken}` },
          }
        );
        if (guildRes.ok) {
          const guildData: DiscordGuild = await guildRes.json();
          totalMembers = guildData.approximate_member_count ?? 0;
        }
      } catch (e) {
        console.error("Error fetching guild from Discord:", e);
      }
    }

    // Get XP user stats
    const [userStats] = await pool.query<StatsRow[]>(
      `SELECT
        COUNT(*) as total_members,
        COALESCE(SUM(text_xp), 0) as total_text_xp,
        COALESCE(SUM(voice_xp), 0) as total_voice_xp,
        COALESCE(AVG(text_level), 0) as avg_text_level,
        COALESCE(AVG(voice_level), 0) as avg_voice_level,
        COALESCE(MAX(text_level), 0) as max_text_level,
        COALESCE(MAX(voice_level), 0) as max_voice_level,
        COALESCE((SELECT AVG(text_xp) FROM xp_users WHERE guild_id = ? AND text_xp > 0), 0) as avg_text_xp_per_member,
        COALESCE((SELECT AVG(voice_xp) FROM xp_users WHERE guild_id = ? AND voice_xp > 0), 0) as avg_voice_xp_per_member,
        COALESCE((SELECT AVG(text_level) FROM xp_users WHERE guild_id = ? AND text_level >= 1), 0) as avg_text_level_exclude_zero,
        COALESCE((SELECT AVG(voice_level) FROM xp_users WHERE guild_id = ? AND voice_level >= 1), 0) as avg_voice_level_exclude_zero
       FROM xp_users
       WHERE guild_id = ?`,
      [guildId, guildId, guildId, guildId, guildId]
    );

    // Get XP settings
    const [settings] = await pool.query<SettingsRow[]>(
      `SELECT enabled, text_xp_enabled, voice_xp_enabled FROM xp_settings WHERE guild_id = ?`,
      [guildId]
    );

    // Get today's activity (users who earned XP today)
    const [todayActivity] = await pool.query<RowDataPacket[]>(
      `SELECT
        COUNT(DISTINCT CASE WHEN DATE(last_text_xp_at) = CURDATE() THEN user_id END) as text_active,
        COUNT(DISTINCT CASE WHEN DATE(last_voice_xp_at) = CURDATE() THEN user_id END) as voice_active
       FROM xp_users
       WHERE guild_id = ?`,
      [guildId]
    );

    // Get top 5 users (by total XP = text_xp + voice_xp)
    const [topUsers] = await pool.query<RowDataPacket[]>(
      `SELECT user_id, text_xp, voice_xp, text_level, voice_level
       FROM xp_users
       WHERE guild_id = ?
       ORDER BY (text_xp + voice_xp) DESC
       LIMIT 5`,
      [guildId]
    );

    const stats = userStats[0] ?? {
      total_members: 0,
      total_text_xp: 0,
      total_voice_xp: 0,
      avg_text_level: 0,
      avg_voice_level: 0,
      max_text_level: 0,
      max_voice_level: 0,
      avg_text_xp_per_member: 0,
      avg_voice_xp_per_member: 0,
      avg_text_level_exclude_zero: 0,
      avg_voice_level_exclude_zero: 0,
    };
    const xpSettings = settings[0] ?? { enabled: false, text_xp_enabled: false, voice_xp_enabled: false };
    const activity = todayActivity[0] ?? { text_active: 0, voice_active: 0 };

    return NextResponse.json({
      totalMembers: totalMembers,
      membersWithXp: Number(stats.total_members),
      totalTextXp: Number(stats.total_text_xp),
      totalVoiceXp: Number(stats.total_voice_xp),
      totalXp: Number(stats.total_text_xp) + Number(stats.total_voice_xp),
      avgTextLevel: Math.round(Number(stats.avg_text_level) * 10) / 10,
      avgVoiceLevel: Math.round(Number(stats.avg_voice_level) * 10) / 10,
      maxTextLevel: Number(stats.max_text_level),
      maxVoiceLevel: Number(stats.max_voice_level),
      avgTextXpPerMember: Math.round(Number(stats.avg_text_xp_per_member)),
      avgVoiceXpPerMember: Math.round(Number(stats.avg_voice_xp_per_member)),
      avgTextLevelExcludeZero: Math.round(Number(stats.avg_text_level_exclude_zero) * 10) / 10,
      avgVoiceLevelExcludeZero: Math.round(Number(stats.avg_voice_level_exclude_zero) * 10) / 10,
      xpEnabled: xpSettings.enabled,
      textXpEnabled: xpSettings.text_xp_enabled,
      voiceXpEnabled: xpSettings.voice_xp_enabled,
      todayTextActive: Number(activity.text_active),
      todayVoiceActive: Number(activity.voice_active),
      topUsers: topUsers.map((u) => ({
        userId: u.user_id,
        textXp: Number(u.text_xp),
        voiceXp: Number(u.voice_xp),
        totalXp: Number(u.text_xp) + Number(u.voice_xp),
        textLevel: Number(u.text_level),
        voiceLevel: Number(u.voice_level),
      })),
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
