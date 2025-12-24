import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createContainer } from "@topia/infra";

// DELETE: 색상 옵션 삭제
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ guildId: string; id: string; colorId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { colorId } = await params;
  const optionId = parseInt(colorId, 10);

  if (isNaN(optionId)) {
    return NextResponse.json({ error: "Invalid color option ID" }, { status: 400 });
  }

  const container = createContainer();
  const result = await container.shopService.deleteColorOption(optionId);

  if (!result.success) {
    return NextResponse.json(
      { error: "Failed to delete color option" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
