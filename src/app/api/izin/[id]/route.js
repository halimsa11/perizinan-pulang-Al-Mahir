import { sql } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";

// PATCH /api/izin/[id] — update izin (sign by ortu, approve/reject by wali)
export async function PATCH(req, { params }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const users = await sql`SELECT * FROM users WHERE id = ${auth.id}`;
    if (users.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const user = users[0];

    const { id } = params;
    const rows = await sql`SELECT * FROM izin WHERE id = ${id}`;
    if (rows.length === 0) return NextResponse.json({ error: "Izin tidak ditemukan." }, { status: 404 });

    const izin = rows[0];
    const body = await req.json();

    if (user.role === "ortu") {
      // Orang tua: sign or reject
      if (izin.status !== "menunggu_ortu") {
        return NextResponse.json({ error: "Izin ini tidak dalam status menunggu orang tua." }, { status: 400 });
      }
      if (user.child_nis !== izin.nis) {
        return NextResponse.json({ error: "Anda tidak punya akses ke izin ini." }, { status: 403 });
      }

      const { approve, ttdOrtu, ortuNama, catatanOrtu } = body;

      if (!ortuNama) {
        return NextResponse.json({ error: "Nama orang tua wajib diisi." }, { status: 400 });
      }
      if (approve && !ttdOrtu) {
        return NextResponse.json({ error: "Tanda tangan wajib diisi." }, { status: 400 });
      }

      await sql`
        UPDATE izin SET
          status = ${approve ? "menunggu_wali" : "ditolak_ortu"},
          ortu_nama = ${ortuNama},
          ortu_uid = ${user.id},
          ortu_at = NOW(),
          catatan_ortu = ${catatanOrtu || ""},
          ttd_ortu = ${approve ? ttdOrtu : null}
        WHERE id = ${id}
      `;

      return NextResponse.json({
        ok: true,
        message: approve ? "Tanda tangan terkirim ke sekolah." : "Izin ditolak.",
      });
    }

    if (user.role === "wali") {
      // Sekolah: approve or reject
      if (izin.status !== "menunggu_wali") {
        return NextResponse.json({ error: "Izin ini belum siap untuk diproses sekolah." }, { status: 400 });
      }

      const { approve, catatanWali } = body;

      if (!approve && !catatanWali) {
        return NextResponse.json({ error: "Isi alasan penolakan." }, { status: 400 });
      }

      await sql`
        UPDATE izin SET
          status = ${approve ? "disetujui" : "ditolak_wali"},
          wali_nama = ${user.nama},
          wali_uid = ${user.id},
          wali_at = NOW(),
          catatan_wali = ${catatanWali || ""}
        WHERE id = ${id}
      `;

      return NextResponse.json({
        ok: true,
        message: approve ? "Izin disetujui." : "Izin ditolak.",
      });
    }

    return NextResponse.json({ error: "Aksi tidak diizinkan untuk role Anda." }, { status: 403 });
  } catch (err) {
    console.error("PATCH izin error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
