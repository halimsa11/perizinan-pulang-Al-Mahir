# Izin Pulang Bulanan (Next.js + Neon PostgreSQL)

Aplikasi web modern untuk perizinan kepulangan santri/siswa bulanan:
- **Siswa**: Mengajukan izin pulang bulanan (bulan, tanggal pulang, tanggal kembali, alasan).
- **Orang Tua**: Menerima pengajuan secara otomatis via NIS anak, meninjau, menandatangani digital langsung di layar HP (canvas signature), atau menolak.
- **Sekolah (Wali Kelas / Asrama)**: Memeriksa tanda tangan orang tua, menyetujui/menolak pengajuan, mencetak/save PDF surat izin resmi, dan ekspor data rekapitulasi ke format CSV.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router, Server-side API Routes)
- **Database**: [Neon Serverless PostgreSQL](https://neon.tech/) (`@neondatabase/serverless`)
- **Authentication**: JWT Cookie (`jose`) & Password Hashing (`bcryptjs`)
- **Deployment**: [Vercel](https://vercel.com/)

---

## 🚀 Menjalankan Secara Lokal (Local Development)

### 1. Salin Environment Variables
Pastikan file `.env.local` ada di direktori root project:

```env
DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
JWT_SECRET="ganti-dengan-random-string-rahasia"
NEXT_PUBLIC_NAMA_SEKOLAH="Nama Sekolah Anda"
```

### 2. Inisialisasi Database
Jalankan skrip migrasi/setup schema tabel ke Neon DB:

```bash
node --env-file=.env.local scripts/setup-db.js
```

### 3. Jalankan Server Development
```bash
npm install
npm run dev
```
Buka browser di [http://localhost:3000](http://localhost:3000).

---

## 🌐 Deploy ke Vercel

1. **Push ke GitHub**:
   Buat repository baru di GitHub, lalu jalankan:
   ```bash
   git remote add origin https://github.com/USERNAME/REPO_NAME.git
   git push -u origin main
   ```

2. **Import ke Vercel**:
   - Buka [vercel.com](https://vercel.com/) dan login menggunakan akun GitHub Anda.
   - Klik **Add New...** > **Project**, lalu pilih repository `izin-pulang`.
   - Di bagian **Environment Variables**, tambahkan:
     - `DATABASE_URL`: Connection string dari Neon PostgreSQL
     - `JWT_SECRET`: Kunci rahasia untuk tanda tangan token JWT
     - `NEXT_PUBLIC_NAMA_SEKOLAH`: Nama sekolah / pondok pesantren Anda
   - Klik **Deploy**.

---

## 👥 Pengguna & Akun

| Peran | Pendaftaran | Login Menggunakan |
|---|---|---|
| **Siswa** | Menu Registrasi -> Siswa | NIS & Password |
| **Orang Tua** | Menu Registrasi -> Orang Tua (isi NIS Anak) | Username/HP & Password |
| **Wali Kelas / Sekolah** | Menu Registrasi -> Wali Kelas | Username & Password |
