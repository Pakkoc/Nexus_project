import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateTicketRoleOptionSchema } from "@/types/shop-v2";
import type { RowDataPacket } from "mysql2";

interface RoleOptionRow extends RowDataPacket {
  id: number;
  ticket_id: number;
  role_id: string;
  name: string;
  description: string | null;
  display_order: number;
  created_at: Date;
}

function rowToRoleOption(row: RoleOptionRow) {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    roleId: row.role_id,
    name: row.name,
    description: row.description,
    displayOrder: row.display_order,
    createdAt: row.created_at.toISOString(),
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; id: string; roleId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId, id, roleId } = await params;
  const ticketId = parseInt(id, 10);
  const optionId = parseInt(roleId, 10);

  try {
    const body = await request.json();
    const validatedData = updateTicketRoleOptionSchema.parse(body);

    const pool = db();

    // Check if ticket exists and belongs to guild
    const [ticketRows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM role_tickets WHERE id = ? AND guild_id = ?",
      [ticketId, guildId]
    );

    if (ticketRows.length === 0) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Check if role option exists and belongs to ticket
    const [optionRows] = await pool.query<RoleOptionRow[]>(
      "SELECT * FROM ticket_role_options WHERE id = ? AND ticket_id = ?",
      [optionId, ticketId]
    );

    if (optionRows.length === 0) {
      return NextResponse.json({ error: "Role option not found" }, { status: 404 });
    }

    // Build update query
    const updates: string[] = [];
    const values: unknown[] = [];

    if (validatedData.roleId !== undefined) {
      updates.push("role_id = ?");
      values.push(validatedData.roleId);
    }
    if (validatedData.name !== undefined) {
      updates.push("name = ?");
      values.push(validatedData.name);
    }
    if (validatedData.description !== undefined) {
      updates.push("description = ?");
      values.push(validatedData.description);
    }
    if (validatedData.displayOrder !== undefined) {
      updates.push("display_order = ?");
      values.push(validatedData.displayOrder);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    values.push(optionId, ticketId);
    await pool.execute(
      `UPDATE ticket_role_options SET ${updates.join(", ")} WHERE id = ? AND ticket_id = ?`,
      values
    );

    const [rows] = await pool.query<RoleOptionRow[]>(
      "SELECT * FROM ticket_role_options WHERE id = ?",
      [optionId]
    );

    return NextResponse.json(rowToRoleOption(rows[0]!));
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("Error updating role option:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string; id: string; roleId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId, id, roleId } = await params;
  const ticketId = parseInt(id, 10);
  const optionId = parseInt(roleId, 10);

  try {
    const pool = db();

    // Check if ticket exists and belongs to guild
    const [ticketRows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM role_tickets WHERE id = ? AND guild_id = ?",
      [ticketId, guildId]
    );

    if (ticketRows.length === 0) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Check if role option exists
    const [optionRows] = await pool.query<RoleOptionRow[]>(
      "SELECT * FROM ticket_role_options WHERE id = ? AND ticket_id = ?",
      [optionId, ticketId]
    );

    if (optionRows.length === 0) {
      return NextResponse.json({ error: "Role option not found" }, { status: 404 });
    }

    await pool.execute(
      "DELETE FROM ticket_role_options WHERE id = ? AND ticket_id = ?",
      [optionId, ticketId]
    );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting role option:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
