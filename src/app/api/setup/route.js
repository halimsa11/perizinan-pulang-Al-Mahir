import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        nama VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('siswa', 'ortu', 'wali')),
        nis VARCHAR(50),
        kelas VARCHAR(50),
        child_nis VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS izin (
        id VARCHAR(255) PRIMARY KEY,
        siswa_uid INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        nis VARCHAR(50) NOT NULL,
        nama VARCHAR(255) NOT NULL,
        kelas VARCHAR(50) NOT NULL,
        bulan VARCHAR(7) NOT NULL,
        tgl_pulang DATE NOT NULL,
        tgl_kembali DATE NOT NULL,
        alasan TEXT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'menunggu_ortu',
        ttd_ortu TEXT,
        ortu_nama VARCHAR(255),
        ortu_uid INTEGER REFERENCES users(id),
        ortu_at TIMESTAMPTZ,
        catatan_ortu TEXT,
        wali_nama VARCHAR(255),
        wali_uid INTEGER REFERENCES users(id),
        wali_at TIMESTAMPTZ,
        catatan_wali TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_izin_siswa ON izin(siswa_uid)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_izin_nis ON izin(nis)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_izin_bulan ON izin(bulan)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_izin_status ON izin(status)`;

    return NextResponse.json({ ok: true, message: "Database tables created successfully." });
  } catch (err) {
    console.error("Setup error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
