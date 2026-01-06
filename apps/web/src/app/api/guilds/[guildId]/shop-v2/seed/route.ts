import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_SHOP_ITEMS } from "@topia/core";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface ExistingItemRow extends RowDataPacket {
  item_type: string;
}

/**
 * GET: 등록 가능한 기본 아이템 목록 조회
 */
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

    // 기존에 등록된 시스템 아이템 타입 조회
    const [existingRows] = await pool.query<ExistingItemRow[]>(
      `SELECT item_type FROM shop_items_v2 WHERE guild_id = ? AND item_type IS NOT NULL AND item_type != 'custom'`,
      [guildId]
    );

    const existingTypes = new Set(existingRows.map((r) => r.item_type));

    // 모든 기본 아이템에 등록 여부 표시
    const items = DEFAULT_SHOP_ITEMS.map((item) => ({
      itemType: item.itemType,
      name: item.name,
      description: item.description,
      isRoleItem: item.isRoleItem,
      durationDays: item.durationDays,
      alreadyExists: existingTypes.has(item.itemType),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching default shop items:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST: 선택한 기본 아이템 등록
 */
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
    const selectedTypes: string[] = body.itemTypes || [];

    if (selectedTypes.length === 0) {
      return NextResponse.json({
        success: false,
        message: "추가할 아이템을 선택해주세요.",
        seeded: 0,
      });
    }

    const pool = db();

    // 기존에 등록된 시스템 아이템 타입 조회
    const [existingRows] = await pool.query<ExistingItemRow[]>(
      `SELECT item_type FROM shop_items_v2 WHERE guild_id = ? AND item_type IS NOT NULL AND item_type != 'custom'`,
      [guildId]
    );

    const existingTypes = new Set(existingRows.map((r) => r.item_type));

    // 선택한 아이템 중 등록 가능한 것만 필터링
    const itemsToSeed = DEFAULT_SHOP_ITEMS.filter(
      (item) => selectedTypes.includes(item.itemType) && !existingTypes.has(item.itemType)
    );

    if (itemsToSeed.length === 0) {
      return NextResponse.json({
        success: true,
        message: "선택한 아이템이 이미 모두 등록되어 있습니다.",
        seeded: 0,
      });
    }

    // 아이템 등록 (가격 0원, 비활성화)
    const insertedItems: string[] = [];

    for (const item of itemsToSeed) {
      // shop_items_v2에 아이템 등록
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO shop_items_v2
         (guild_id, name, description, item_type, topy_price, ruby_price, currency_type, duration_days, stock, max_per_user, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          guildId,
          item.name,
          item.description,
          item.itemType,
          0, // topy_price = 0
          null, // ruby_price = null
          item.currencyType,
          item.durationDays,
          null, // stock = null (무제한)
          null, // max_per_user = null (무제한)
          0, // enabled = false (비활성화)
        ]
      );

      // 역할지급형 아이템이면 role_tickets에도 등록
      if (item.isRoleItem) {
        const shopItemId = result.insertId;
        // 효과 지속 시간: durationDays를 초로 변환
        const effectDurationSeconds = item.durationDays > 0 ? item.durationDays * 24 * 60 * 60 : null;

        await pool.execute<ResultSetHeader>(
          `INSERT INTO role_tickets
           (guild_id, name, description, shop_item_id, consume_quantity, remove_previous_role, fixed_role_id, effect_duration_seconds, enabled)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            guildId,
            item.name,
            item.description,
            shopItemId,
            1, // consume_quantity = 1
            1, // remove_previous_role = true
            null, // fixed_role_id = null (관리자가 설정)
            effectDurationSeconds,
            1, // enabled = true
          ]
        );
      }

      insertedItems.push(item.name);
    }

    return NextResponse.json({
      success: true,
      message: `${insertedItems.length}개의 기본 아이템이 등록되었습니다.`,
      seeded: insertedItems.length,
      items: insertedItems,
    });
  } catch (error) {
    console.error("Error seeding default shop items:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
