# Izin Pulang Bulanan (web app)

Siswa mengajukan izin pulang bulanan, orang tua menandatangani langsung di layar HP, lalu pihak sekolah
menyetujui. Semua pihak melihat status secara real time, tanpa form kertas.

## Alur

1. **Siswa** mengisi pengajuan (bulan, tanggal pulang, tanggal kembali, alasan).
2. **Orang tua** menerima pengajuan otomatis di akunnya (berdasarkan NIS anak), meninjau, lalu menggambar tanda tangan atau menolak.
3. **Sekolah (wali kelas/asrama)** melihat izin yang sudah ditandatangani, lalu menyetujui atau menolak.
4. Surat izin yang disetujui bisa dicetak atau disimpan sebagai PDF. Sekolah bisa mengekspor rekap bulanan ke CSV.

Satu siswa hanya bisa mengajukan satu izin per bulan. Jika ditolak, siswa bisa mengajukan ulang.

## Setup (sekitar 10 menit)

### 1. Buat project Firebase
1. Buka https://console.firebase.google.com lalu **Add project**.
2. Di **Build > Authentication > Sign-in method**, aktifkan **Email/Password**.
3. Di **Build > Firestore Database**, klik **Create database** (pilih lokasi terdekat, mis. `asia-southeast2` Jakarta).
4. Di **Project settings > General > Your apps**, tambahkan **Web app** (ikon `</>`) lalu salin objek `firebaseConfig`.

### 2. Isi konfigurasi
Buka `firebase-config.js`, tempel nilai `apiKey`, `authDomain`, `projectId`, `appId`, dan ganti `NAMA_SEKOLAH`.

### 3. Pasang aturan keamanan
Di **Firestore Database > Rules**, tempel seluruh isi `firestore.rules` lalu **Publish**.

### 4. Buat akun wali kelas / sekolah
Peran sekolah sengaja tidak bisa didaftarkan dari aplikasi supaya aman.
1. Di **Authentication > Users > Add user**, buat akun dengan email dan kata sandi. Salin **User UID**-nya.
2. Di **Firestore Database > Start collection** (jika belum ada), buat collection `users`, lalu tambahkan dokumen dengan **Document ID = User UID tadi** dan field:
   - `role` (string): `wali`
   - `nama` (string): nama wali kelas, mis. `Bu Sari`
3. Wali masuk di aplikasi memakai email dan kata sandi tersebut.

### 5. Jalankan
Aplikasi memakai ES module, jadi tidak bisa dibuka langsung dengan klik dua kali (`file://`). Pilih salah satu:

- **Coba lokal:** di folder ini jalankan `python3 -m http.server 8000`, lalu buka http://localhost:8000
- **Online (disarankan):** Firebase Hosting (`npm i -g firebase-tools`, `firebase login`, `firebase init hosting`, `firebase deploy`), Netlify, atau Vercel. Setelah punya domain, tambahkan di **Authentication > Settings > Authorized domains**.

## Cara pakai

| Peran | Daftar | Masuk dengan |
|---|---|---|
| Siswa | Menu Daftar, pilih Siswa, isi nama, NIS, kelas | NIS dan kata sandi |
| Orang tua | Menu Daftar, pilih Orang tua, isi nama, username (email atau No. HP), NIS anak | Username dan kata sandi |
| Sekolah | Dibuat admin (langkah 4) | Email dan kata sandi |

## Catatan keamanan dan pengembangan lanjutan

- Orang tua terhubung ke siswa lewat **NIS anak**. Siapa pun yang tahu NIS bisa mendaftar sebagai "orang tua" anak itu. Untuk sekolah yang butuh kepastian lebih, tambahkan langkah verifikasi akun orang tua oleh sekolah (mis. field `terverifikasi` yang hanya bisa diubah wali), atau impor data NIS dan nomor HP orang tua dari sekolah.
- Notifikasi saat ini muncul di dalam aplikasi secara real time. Untuk notifikasi WhatsApp atau push (saat aplikasi tertutup), perlu tambahan Cloud Functions atau Firebase Cloud Messaging.
- Tanda tangan disimpan sebagai gambar kecil (PNG) di dokumen izin. Ini cukup untuk bukti izin internal sekolah, tetapi bukan tanda tangan elektronik tersertifikasi.
- Paket gratis Firebase (Spark) cukup untuk satu sekolah dengan ratusan siswa.
