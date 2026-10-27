import { sql } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createToken, setTokenCookie } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const { username, password, nama, role, nis, kelas, childNis } = body;

    if (!username || !password || !nama || !role) {
      return NextResponse.json({ error: "Semua field wajib diisi." }, { status: 400 });
    }
    if (!["siswa", "ortu"].includes(role)) {
      return NextResponse.json({ error: "Role tidak valid." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Kata sandi minimal 6 karakter." }, { status: 400 });
    }
    if (role === "siswa" && (!nis || !kelas)) {
      return NextResponse.json({ error: "NIS dan kelas wajib diisi." }, { status: 400 });
    }
    if (role === "ortu" && !childNis) {
      return NextResponse.json({ error: "NIS anak wajib diisi." }, { status: 400 });
    }

    const uname = username.toLowerCase().trim().replace(/\s+/g, "");
    const hash = await bcrypt.hash(password, 10);

    const rows = await sql`
      INSERT INTO users (username, password_hash, nama, role, nis, kelas, child_nis)
      VALUES (${uname}, ${hash}, ${nama.trim()}, ${role},
              ${nis?.trim() || null}, ${kelas?.trim() || null}, ${childNis?.trim() || null})
      RETURNING id, username, nama, role, nis, kelas, child_nis
    `;
    const user = rows[0];

    const token = await createToken({ id: user.id, role: user.role });
    const res = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        nama: user.nama,
        role: user.role,
        nis: user.nis,
        kelas: user.kelas,
        childNis: user.child_nis,
      },
    });
    setTokenCookie(res, token);
    return res;
  } catch (err) {
    console.error("Register error:", err);
    if (err.message?.includes("unique") || err.message?.includes("duplicate")) {
      return NextResponse.json({ error: "Username/NIS ini sudah terdaftar." }, { status: 409 });
    }
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
