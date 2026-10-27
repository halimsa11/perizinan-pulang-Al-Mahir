import { sql } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/izin — list izin based on user role
export async function GET(req) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const bulan = searchParams.get("bulan") || "";
    const status = searchParams.get("status") || "";
    const search = searchParams.get("search") || "";

    // Get user profile for role-based filtering
    const users = await sql`SELECT * FROM users WHERE id = ${auth.id}`;
    if (users.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const user = users[0];

    let items;

    if (user.role === "siswa") {
      items = await sql`
        SELECT * FROM izin WHERE siswa_uid = ${user.id}
        ORDER BY bulan DESC, nama ASC
      `;
    } else if (user.role === "ortu") {
      items = await sql`
        SELECT * FROM izin WHERE nis = ${user.child_nis}
        ORDER BY bulan DESC, nama ASC
      `;
    } else if (user.role === "wali") {
      items = await sql`SELECT * FROM izin ORDER BY bulan DESC, nama ASC`;
    } else {
      return NextResponse.json({ error: "Role tidak dikenal" }, { status: 403 });
    }

    // Apply filters
    let filtered = items;
    if (bulan) {
      filtered = filtered.filter((i) => i.bulan === bulan);
    }
    if (status) {
      filtered = filtered.filter((i) => i.status === status);
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.nama.toLowerCase().includes(q) ||
          i.nis.toLowerCase().includes(q) ||
          i.kelas.toLowerCase().includes(q)
      );
    }

    return NextResponse.json({ items: filtered });
  } catch (err) {
    console.error("GET izin error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/izin — create new izin (siswa only)
export async function POST(req) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const users = await sql`SELECT * FROM users WHERE id = ${auth.id}`;
    if (users.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const user = users[0];

    if (user.role !== "siswa") {
      return NextResponse.json({ error: "Hanya siswa yang bisa mengajukan izin." }, { status: 403 });
    }

    const { bulan, tglPulang, tglKembali, alasan } = await req.json();

    if (!bulan || !tglPulang || !tglKembali || !alasan) {
      return NextResponse.json({ error: "Semua field wajib diisi." }, { status: 400 });
    }
    if (tglKembali < tglPulang) {
      return NextResponse.json({ error: "Tanggal kembali tidak boleh sebelum tanggal pulang." }, { status: 400 });
    }

    const id = `${user.id}_${bulan}`;

    // Check existing
    const existing = await sql`SELECT id, status FROM izin WHERE id = ${id}`;
    if (existing.length > 0 && !existing[0].status.startsWith("ditolak")) {
      return NextResponse.json({ error: "Izin untuk bulan ini sudah diajukan." }, { status: 409 });
    }

    // Delete old rejected one if exists
    if (existing.length > 0) {
      await sql`DELETE FROM izin WHERE id = ${id}`;
    }

    await sql`
      INSERT INTO izin (id, siswa_uid, nis, nama, kelas, bulan, tgl_pulang, tgl_kembali, alasan, status)
      VALUES (${id}, ${user.id}, ${user.nis}, ${user.nama}, ${user.kelas},
              ${bulan}, ${tglPulang}, ${tglKembali}, ${alasan.trim()}, 'menunggu_ortu')
    `;

    return NextResponse.json({ ok: true, message: "Izin terkirim. Menunggu tanda tangan orang tua." });
  } catch (err) {
    console.error("POST izin error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
