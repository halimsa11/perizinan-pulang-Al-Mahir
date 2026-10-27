import { sql } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createToken, setTokenCookie } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Username dan kata sandi wajib diisi." }, { status: 400 });
    }

    const uname = username.toLowerCase().trim().replace(/\s+/g, "");

    const rows = await sql`
      SELECT id, username, password_hash, nama, role, nis, kelas, child_nis
      FROM users WHERE username = ${uname}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Username atau kata sandi salah." }, { status: 401 });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return NextResponse.json({ error: "Username atau kata sandi salah." }, { status: 401 });
    }

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
    console.error("Login error:", err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
