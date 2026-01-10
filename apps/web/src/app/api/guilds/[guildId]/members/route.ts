import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

interface XpUserRow extends RowDataPacket {
  user_id: string;
  text_xp: number;
  voice_xp: number;
  text_level: number;
  voice_level: number;
  last_text_xp_at: Date | null;
  last_voice_xp_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface DiscordGuildMember {
  user: {
    id: string;
    username: string;
    global_name?: string;
    avatar?: string;
    bot?: boolean;
  };
  nick?: string;
  avatar?: string;
  joined_at: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getServerSession(authOptions);
  const { guildId } = await params;

  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sortBy") || "xp";
  const sortOrder = searchParams.get("sortOrder") || "desc";

  try {
    const botToken = process.env.DISCORD_TOKEN;
    if (!botToken) {
      return NextResponse.json({ error: "Bot token not configured" }, { status: 500 });
    }

    const pool = db();

    // For XP/level sorting, use DB-first approach (leaderboard)
    if ((sortBy === "xp" || sortBy === "level" || sortBy === "textXp" || sortBy === "voiceXp" || sortBy === "textLevel" || sortBy === "voiceLevel") && !search) {
      // Determine ORDER BY clause
      let orderByColumn = "(text_xp + voice_xp)";
      if (sortBy === "textXp") orderByColumn = "text_xp";
      else if (sortBy === "voiceXp") orderByColumn = "voice_xp";
      else if (sortBy === "level" || sortBy === "textLevel") orderByColumn = "text_level";
      else if (sortBy === "voiceLevel") orderByColumn = "voice_level";

      // Get XP users from DB first
      const [xpRows] = await pool.query<XpUserRow[]>(
        `SELECT user_id, text_xp, voice_xp, text_level, voice_level, last_text_xp_at, last_voice_xp_at, created_at, updated_at
         FROM xp_users
         WHERE guild_id = ? AND (text_xp > 0 OR voice_xp > 0)
         ORDER BY ${orderByColumn} ${sortOrder === "asc" ? "ASC" : "DESC"}`,
        [guildId]
      );

      // Fetch Discord info for these users
      const mergedMembers = await Promise.all(
        xpRows.map(async (xpData) => {
          let username = `User ${xpData.user_id.slice(-4)}`;
          let displayName = username;
          let avatar: string | null = null;
          let joinedAt = xpData.created_at.toISOString();

          try {
            // Try to get user info from Discord
            const userResponse = await fetch(
              `https://discord.com/api/v10/users/${xpData.user_id}`,
              { headers: { Authorization: `Bot ${botToken}` } }
            );
            if (userResponse.ok) {
              const userData = await userResponse.json();
              username = userData.username;
              displayName = userData.global_name || userData.username;
              avatar = userData.avatar
                ? `https://cdn.discordapp.com/avatars/${xpData.user_id}/${userData.avatar}.png`
                : null;
            }
          } catch {
            // Ignore Discord API errors, use defaults
          }

          return {
            userId: xpData.user_id,
            username,
            displayName,
            avatar,
            joinedAt,
            textXp: xpData.text_xp,
            voiceXp: xpData.voice_xp,
            totalXp: xpData.text_xp + xpData.voice_xp,
            textLevel: xpData.text_level,
            voiceLevel: xpData.voice_level,
            lastTextXpAt: xpData.last_text_xp_at,
            lastVoiceXpAt: xpData.last_voice_xp_at,
            hasXpData: true,
          };
        })
      );

      // Apply pagination
      const total = mergedMembers.length;
      const offset = (page - 1) * limit;
      const paginatedMembers = mergedMembers.slice(offset, offset + limit);

      return NextResponse.json({
        members: paginatedMembers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    // For other sorting or search, use Discord-first approach
    const discordMembers: DiscordGuildMember[] = [];
    let after = "0";

    // Fetch members in batches (Discord limits to 1000 per request)
    while (true) {
      const response = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000&after=${after}`,
        {
          headers: { Authorization: `Bot ${botToken}` },
        }
      );

      if (!response.ok) {
        console.error("Discord API error:", response.status);
        break;
      }

      const batch: DiscordGuildMember[] = await response.json();
      if (batch.length === 0) break;

      discordMembers.push(...batch);
      after = batch[batch.length - 1]!.user.id;

      // Safety limit to prevent infinite loops
      if (discordMembers.length >= 10000 || batch.length < 1000) break;
    }

    // Filter out bots
    const humanMembers = discordMembers.filter(m => !m.user.bot);

    // Get XP data for all members
    const [xpRows] = await pool.query<XpUserRow[]>(
      `SELECT user_id, text_xp, voice_xp, text_level, voice_level, last_text_xp_at, last_voice_xp_at, created_at, updated_at
       FROM xp_users WHERE guild_id = ?`,
      [guildId]
    );

    // Create a map of user_id -> XP data
    const xpMap = new Map<string, XpUserRow>();
    for (const row of xpRows) {
      xpMap.set(row.user_id, row);
    }

    // Merge Discord members with XP data
    let mergedMembers = humanMembers.map((member) => {
      const xpData = xpMap.get(member.user.id);
      const memberAvatar = member.avatar
        ? `https://cdn.discordapp.com/guilds/${guildId}/users/${member.user.id}/avatars/${member.avatar}.png`
        : member.user.avatar
        ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png`
        : null;

      return {
        userId: member.user.id,
        username: member.user.username,
        displayName: member.nick || member.user.global_name || member.user.username,
        avatar: memberAvatar,
        joinedAt: member.joined_at,
        textXp: xpData?.text_xp ?? 0,
        voiceXp: xpData?.voice_xp ?? 0,
        totalXp: (xpData?.text_xp ?? 0) + (xpData?.voice_xp ?? 0),
        textLevel: xpData?.text_level ?? 0,
        voiceLevel: xpData?.voice_level ?? 0,
        lastTextXpAt: xpData?.last_text_xp_at ?? null,
        lastVoiceXpAt: xpData?.last_voice_xp_at ?? null,
        hasXpData: !!xpData,
      };
    });

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      mergedMembers = mergedMembers.filter(
        (m) =>
          m.username.toLowerCase().includes(searchLower) ||
          m.displayName.toLowerCase().includes(searchLower) ||
          m.userId.includes(search)
      );
    }

    // Apply sorting
    const sortMultiplier = sortOrder === "asc" ? 1 : -1;
    mergedMembers.sort((a, b) => {
      switch (sortBy) {
        case "xp":
        case "totalXp":
          return (a.totalXp - b.totalXp) * sortMultiplier;
        case "textXp":
          return (a.textXp - b.textXp) * sortMultiplier;
        case "voiceXp":
          return (a.voiceXp - b.voiceXp) * sortMultiplier;
        case "level":
        case "textLevel":
          return (a.textLevel - b.textLevel) * sortMultiplier;
        case "voiceLevel":
          return (a.voiceLevel - b.voiceLevel) * sortMultiplier;
        case "joinedAt":
          return (new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()) * sortMultiplier;
        case "name":
          return a.displayName.localeCompare(b.displayName) * sortMultiplier;
        default:
          return (a.totalXp - b.totalXp) * sortMultiplier;
      }
    });

    // Apply pagination
    const total = mergedMembers.length;
    const offset = (page - 1) * limit;
    const paginatedMembers = mergedMembers.slice(offset, offset + limit);

    return NextResponse.json({
      members: paginatedMembers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
