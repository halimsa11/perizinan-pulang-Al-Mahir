const { neon } = require("@neondatabase/serverless");
const bcrypt = require("bcryptjs");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set!");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function main() {
  const username = process.argv[2] || "admin";
  const password = process.argv[3] || "admin123";
  const nama = process.argv[4] || "Wali Kelas / Pihak Sekolah";

  const uname = username.toLowerCase().trim().replace(/\s+/g, "");
  const hash = await bcrypt.hash(password, 10);

  try {
    const existing = await sql`SELECT id, username, role FROM users WHERE username = ${uname}`;
    if (existing.length > 0) {
      console.log(`User '${uname}' already exists with role: ${existing[0].role}. Updating password and role to 'wali'...`);
      await sql`
        UPDATE users 
        SET password_hash = ${hash}, role = 'wali', nama = ${nama}
        WHERE id = ${existing[0].id}
      `;
      console.log(`✓ Akun '${uname}' berhasil diperbarui sebagai role 'wali'.`);
    } else {
      await sql`
        INSERT INTO users (username, password_hash, nama, role)
        VALUES (${uname}, ${hash}, ${nama}, 'wali')
      `;
      console.log(`✓ Akun Wali Kelas '${uname}' berhasil dibuat!`);
    }

    console.log("\n--- Kredensial Login Wali ---");
    console.log(`Username : ${uname}`);
    console.log(`Password : ${password}`);
    console.log(`Role     : wali (Pihak Sekolah)`);
    console.log("-----------------------------\n");
  } catch (err) {
    console.error("Gagal membuat akun wali:", err);
  }
}

main();
