import { sql } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) {
      return NextResponse.json({ user: null });
    }

    const rows = await sql`
      SELECT id, username, nama, role, nis, kelas, child_nis
      FROM users WHERE id = ${auth.id}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ user: null });
    }

    const u = rows[0];
    return NextResponse.json({
      user: {
        id: u.id,
        username: u.username,
        nama: u.nama,
        role: u.role,
        nis: u.nis,
        kelas: u.kelas,
        childNis: u.child_nis,
      },
    });
  } catch (err) {
    console.error("Me error:", err);
    return NextResponse.json({ user: null });
  }
}
