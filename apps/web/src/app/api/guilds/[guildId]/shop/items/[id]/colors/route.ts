import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { createContainer } from "@topia/infra";

const createColorOptionSchema = z.object({
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "올바른 HEX 색상을 입력하세요"),
  name: z.string().min(1, "이름을 입력하세요").max(50),
  roleId: z.string().min(1, "역할을 선택하세요"),
});

// GET: 색상 옵션 목록 조회
export async function GET(
  request: Request,
  { params }: { params: Promise<{ guildId: string; id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const itemId = parseInt(id, 10);

  if (isNaN(itemId)) {
    return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
  }

  const container = createContainer();
  const result = await container.shopService.getColorOptions(itemId);

  if (!result.success) {
    return NextResponse.json(
      { error: "Failed to fetch color options" },
      { status: 500 }
    );
  }

  return NextResponse.json(result.data);
}

// POST: 색상 옵션 추가
export async function POST(
  request: Request,
  { params }: { params: Promise<{ guildId: string; id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const itemId = parseInt(id, 10);

  if (isNaN(itemId)) {
    return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
  }

  const body = await request.json();
  const validation = createColorOptionSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.errors[0]?.message || "Invalid request" },
      { status: 400 }
    );
  }

  const { color, name, roleId } = validation.data;

  const container = createContainer();
  const result = await container.shopService.addColorOption(
    itemId,
    color,
    name,
    roleId
  );

  if (!result.success) {
    return NextResponse.json(
      { error: "Failed to add color option" },
      { status: 500 }
    );
  }

  return NextResponse.json(result.data, { status: 201 });
}
