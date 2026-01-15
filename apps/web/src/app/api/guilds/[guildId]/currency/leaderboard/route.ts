import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

interface LeaderboardRow extends RowDataPacket {
  user_id: string;
  balance: string;
  total_earned: string;
}

interface UserInfo {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
}

async function fetchUserInfo(guildId: string, userId: string, botToken: string): Promise<UserInfo> {
  try {
    // 서버 멤버 정보 조회 (서버 닉네임 포함)
    const memberResponse = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
      { headers: { Authorization: `Bot ${botToken}` } }
    );
    if (memberResponse.ok) {
      const memberData = await memberResponse.json();
      const user = memberData.user;
      // 우선순위: 서버 닉네임 > 전역 닉네임 > username
      const displayName = memberData.nick || user.global_name || user.username;
      // 아바타 우선순위: 서버 아바타 > 유저 아바타
      const avatar = memberData.avatar
        ? `https://cdn.discordapp.com/guilds/${guildId}/users/${userId}/avatars/${memberData.avatar}.png`
        : user.avatar
          ? `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png`
          : null;
      return {
        id: userId,
        username: user.username,
        displayName,
        avatar,
      };
    }

    // 멤버 조회 실패 시 유저 정보로 폴백
    const userResponse = await fetch(
      `https://discord.com/api/v10/users/${userId}`,
      { headers: { Authorization: `Bot ${botToken}` } }
    );
    if (userResponse.ok) {
      const userData = await userResponse.json();
      return {
        id: userId,
        username: userData.username,
        displayName: userData.global_name || userData.username,
        avatar: userData.avatar
          ? `https://cdn.discordapp.com/avatars/${userId}/${userData.avatar}.png`
          : null,
      };
    }
  } catch {
    // Ignore errors
  }
  return {
    id: userId,
    username: `User ${userId.slice(-4)}`,
    displayName: `User ${userId.slice(-4)}`,
    avatar: null,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 100);
  const type = searchParams.get("type") || "topy"; // topy or ruby

  try {
    const pool = db();
    const tableName = type === "ruby" ? "ruby_wallets" : "topy_wallets";

    const [rows] = await pool.query<LeaderboardRow[]>(
      `SELECT user_id, balance, total_earned
       FROM ${tableName}
       WHERE guild_id = ? AND balance > 0
       ORDER BY balance DESC
       LIMIT ?`,
      [guildId, limit]
    );

    // 유저 정보 조회 (서버 닉네임)
    const botToken = process.env["DISCORD_TOKEN"];
    const userIds = rows.map((row) => row.user_id);
    const userMap = new Map<string, UserInfo>();

    if (botToken && userIds.length > 0) {
      const userInfos = await Promise.all(
        userIds.map((id) => fetchUserInfo(guildId, id, botToken))
      );
      userInfos.forEach((info) => userMap.set(info.id, info));
    }

    const leaderboard = rows.map((row, index) => {
      const userInfo = userMap.get(row.user_id);
      return {
        rank: index + 1,
        userId: row.user_id,
        username: userInfo?.username ?? `User ${row.user_id.slice(-4)}`,
        displayName: userInfo?.displayName ?? `User ${row.user_id.slice(-4)}`,
        avatar: userInfo?.avatar ?? null,
        balance: row.balance,
        totalEarned: row.total_earned,
      };
    });

    return NextResponse.json({
      type,
      leaderboard,
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
