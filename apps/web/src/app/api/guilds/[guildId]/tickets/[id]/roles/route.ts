import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createTicketRoleOptionSchema } from "@/types/shop-v2";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string; id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId, id } = await params;
  const ticketId = parseInt(id, 10);

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

    const [rows] = await pool.query<RoleOptionRow[]>(
      "SELECT * FROM ticket_role_options WHERE ticket_id = ? ORDER BY display_order ASC",
      [ticketId]
    );

    return NextResponse.json(rows.map(rowToRoleOption));
  } catch (error) {
    console.error("Error fetching role options:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId, id } = await params;
  const ticketId = parseInt(id, 10);

  try {
    const body = await request.json();
    const validatedData = createTicketRoleOptionSchema.parse(body);

    const pool = db();

    // Check if ticket exists and belongs to guild
    const [ticketRows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM role_tickets WHERE id = ? AND guild_id = ?",
      [ticketId, guildId]
    );

    if (ticketRows.length === 0) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Get max display order
    const [maxOrderRows] = await pool.query<(RowDataPacket & { max_order: number | null })[]>(
      "SELECT MAX(display_order) as max_order FROM ticket_role_options WHERE ticket_id = ?",
      [ticketId]
    );
    const maxOrder = maxOrderRows[0]?.max_order ?? -1;
    const displayOrder = validatedData.displayOrder ?? maxOrder + 1;

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO ticket_role_options
       (ticket_id, role_id, name, description, display_order)
       VALUES (?, ?, ?, ?, ?)`,
      [
        ticketId,
        validatedData.roleId,
        validatedData.name,
        validatedData.description ?? null,
        displayOrder,
      ]
    );

    const [rows] = await pool.query<RoleOptionRow[]>(
      "SELECT * FROM ticket_role_options WHERE id = ?",
      [result.insertId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Failed to create role option" },
        { status: 500 }
      );
    }

    return NextResponse.json(rowToRoleOption(rows[0]!), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("Error creating role option:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
