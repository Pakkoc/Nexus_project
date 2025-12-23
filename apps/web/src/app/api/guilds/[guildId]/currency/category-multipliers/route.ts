import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyBotSettingsChanged } from "@/lib/bot-notify";
import { saveCategoryMultiplierSchema } from "@/types/currency";
import type { RowDataPacket } from "mysql2";

interface CategoryMultiplierRow extends RowDataPacket {
  id: number;
  guild_id: string;
  category: "normal" | "music" | "afk" | "premium";
  multiplier: string;
  created_at: Date;
  updated_at: Date;
}

function rowToCategoryMultiplier(row: CategoryMultiplierRow) {
  return {
    id: row.id,
    guildId: row.guild_id,
    category: row.category,
    multiplier: parseFloat(row.multiplier),
  };
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
    const [rows] = await pool.query<CategoryMultiplierRow[]>(
      `SELECT * FROM currency_category_multipliers WHERE guild_id = ?`,
      [guildId]
    );

    return NextResponse.json(rows.map(rowToCategoryMultiplier));
  } catch (error) {
    console.error("Error fetching category multipliers:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId } = await params;

  try {
    const body = await request.json();
    const validatedData = saveCategoryMultiplierSchema.parse(body);

    const pool = db();

    // UPSERT: 있으면 업데이트, 없으면 삽입
    await pool.query(
      `INSERT INTO currency_category_multipliers (guild_id, category, multiplier)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE multiplier = VALUES(multiplier), updated_at = NOW()`,
      [guildId, validatedData.category, validatedData.multiplier]
    );

    notifyBotSettingsChanged({
      guildId,
      type: 'currency-category-multiplier',
      action: '수정',
      details: `${validatedData.category}: x${validatedData.multiplier}`,
    });

    return NextResponse.json({
      success: true,
      category: validatedData.category,
      multiplier: validatedData.multiplier,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("Error saving category multiplier:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId } = await params;
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  if (!category) {
    return NextResponse.json({ error: "Category is required" }, { status: 400 });
  }

  try {
    const pool = db();
    await pool.query(
      `DELETE FROM currency_category_multipliers WHERE guild_id = ? AND category = ?`,
      [guildId, category]
    );

    notifyBotSettingsChanged({
      guildId,
      type: 'currency-category-multiplier',
      action: '초기화',
      details: `${category}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting category multiplier:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
