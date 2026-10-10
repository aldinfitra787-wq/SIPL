# Panduan Instalasi SIPL — SPN Polda Papua Barat

**Sistem Informasi Pendidikan dan Latihan** • Versi 1.0.0

Aplikasi terdiri dari dua bagian yang dipasang terpisah:

| Bagian | Isi | Dipasang di |
|---|---|---|
| **Backend** (server & database) | `Kode.gs`, `Migrasi.gs` | Google Apps Script + Google Sheets + Google Drive |
| **Frontend** (tampilan) | folder `sipl-frontend` (berisi `index.html`, `css/`, `js/`) | GitHub Pages |

Frontend berbicara dengan backend lewat internet (URL `/exec`). Semua pembatasan hak akses per kelas/peleton ditegakkan di **server**, bukan di tampilan.

> Waktu yang dibutuhkan: ± 30–45 menit untuk pemasangan pertama.
> Gunakan **satu akun Google** khusus instansi (misalnya akun Satdik) untuk seluruh langkah backend. Akun ini menjadi pemilik database, dan seluruh kuota Apps Script memakai akun ini.

---

## Bagian A — Memasang Backend (Google Apps Script)

### A1. Buat proyek Apps Script
1. Buka **https://script.google.com** dengan akun Google instansi → klik **Proyek baru**.
2. Klik judul "Proyek tanpa judul" di kiri atas → ganti menjadi **SIPL Backend**.
3. Di panel kiri ada berkas `Code.gs`. Klik ⋮ di sebelahnya → **Ganti nama** → ketik `Kode`.
4. Hapus seluruh isi editor, lalu **tempel seluruh isi `Kode.gs`**.
5. Klik **＋** (Tambahkan berkas) → **Skrip** → beri nama `Migrasi` → tempel seluruh isi **`Migrasi.gs`**.
6. Tekan **Ctrl + S** (simpan).

### A2. Atur zona waktu proyek
1. Klik ikon ⚙️ **Setelan proyek** di panel kiri.
2. Pada **Zona waktu**, pilih **(GMT+09:00) Jayapura**.
3. Pastikan **Aktifkan runtime Chrome V8** tercentang (biasanya sudah).

### A3. Jalankan setup awal (SEKALI SAJA)
1. Kembali ke editor (ikon `< >`), buka berkas **Kode**.
2. Di toolbar atas, pada pilihan fungsi, pilih **`setupAppEnvironment`** → klik **▶ Jalankan**.
3. Muncul permintaan izin → **Tinjau izin** → pilih akun Anda → **Lanjutan** → **Buka SIPL Backend (tidak aman)** → **Izinkan**.
   *(Peringatan "tidak aman" muncul karena skrip buatan sendiri belum diverifikasi Google. Ini wajar.)*
4. Tunggu sampai **Log eksekusi** menampilkan **✅ SETUP SELESAI**.
5. **Catat password Admin** yang tercetat di log:
   ```
   🔑 AKUN ADMIN PERTAMA
      Username : admin
      Password : xxxxxxxxxx
   ```
6. Setup otomatis membuat di Google Drive Anda:
   - Folder **📁 SIPL — SPN Polda Papua Barat** berisi spreadsheet database (13 sheet), folder **Logo Aplikasi**, dan folder **Cadangan Harian**.
   - Pemicu (*trigger*) otomatis: penulisan log tiap 1 menit, cadangan database tiap pukul 02.00 WIT, dan penyegar cache saat Sheets diedit manual.

> ⚠️ Jangan menjalankan `setupAppEnvironment` lebih dari sekali. Bila dijalankan lagi, setup akan menolak agar tidak membuat database ganda.

**Opsional — data contoh untuk uji coba:** pilih fungsi `isiDataContoh` → ▶ Jalankan. Ini mengisi 2 kelas, 4 peleton, 4 mapel, 2 Gadik (`bambang` / `gadik12345`), 2 Pengasuh (`hendra` / `pengasuh123`), dan 24 peserta. **Pakai hanya untuk instalasi uji coba** — akun contoh memiliki password yang tertulis di panduan ini. Untuk instalasi sungguhan, lewati langkah ini.

### A4. Deploy sebagai Web App
1. Klik **Terapkan (Deploy)** → **Deployment baru**.
2. Klik ⚙️ di samping "Pilih jenis" → **Aplikasi web**.
3. Isi:
   - **Deskripsi:** `SIPL v1`
   - **Jalankan sebagai:** **Saya** (akun Anda)
   - **Yang memiliki akses:** **Siapa saja** *(keamanan dijaga oleh login aplikasi)*
4. Klik **Terapkan** → **salin URL Aplikasi web** (berakhiran `/exec`).
5. Uji: tempel URL tersebut di tab browser baru. Harus tampil teks seperti
   `{"success":true,"data":{"appName":"SIPL — SPN Polda Papua Barat",...,"setup":true}}`

---

## Bagian B — Menghubungkan Frontend ke Backend

1. Ekstrak `sipl-frontend.zip`. Hasilnya folder **`sipl-frontend`** yang langsung berisi `index.html`, folder `css`, dan folder `js`.
2. Buka `sipl-frontend/js/config.js` dengan Notepad (Windows) atau TextEdit (Mac).
3. Ganti nilai `GAS_URL` dengan URL `/exec` dari langkah A4:
   ```js
   GAS_URL: 'https://script.google.com/macros/s/AKfycb.....panjang...../exec',
   ```
4. Simpan.

> Bila `GAS_URL` belum diisi, halaman login akan menampilkan peringatan merah "Server belum dihubungkan".

---

## Bagian C — Memasang Frontend ke GitHub Pages

> **Folder kerja = `sipl-frontend`** (hasil ekstrak ZIP). Semua perintah `git` di bawah dijalankan **di dalam folder ini** — bukan di folder induknya.

### C1. Persiapan (sekali seumur komputer)
1. Pasang Git: Windows → https://git-scm.com/download/win (pengaturan bawaan). Mac → buka Terminal, ketik `git --version`.
2. Buat akun di https://github.com (username menjadi bagian alamat situs: `username.github.io`).
3. Atur identitas:
   ```bash
   git config --global user.name "Nama Anda"
   git config --global user.email "email-akun-github@contoh.com"
   ```

### C2. Buat repository
Di github.com: **＋ → New repository** → nama `sipl` → pilih **Public** → **jangan** centang README / .gitignore / license → **Create repository**.

### C3. Masuk ke folder yang BENAR lalu periksa isinya
Windows: buka folder `sipl-frontend` di File Explorer → klik address bar → ketik `powershell` → Enter.
```powershell
dir
```
Yang **harus** terlihat: `index.html`, `css`, `js`, `README.md`, `PANDUAN-INSTALASI.md`.
Kalau yang terlihat justru folder `sipl-frontend` lagi, masuk dulu: `cd sipl-frontend`.

### C4. Kirim ke GitHub (satu per satu)
```bash
git init
git add .
git commit -m "Upload pertama SIPL"
git branch -M main
git remote add origin https://github.com/USERNAME/sipl.git
git push -u origin main
```
- Perhatikan **titik** di akhir `git add .`
- Saat diminta **Password**, tempel **Personal Access Token**, bukan password akun GitHub. Buat token di https://github.com/settings/tokens → *Generate new token (classic)* → centang **repo** → salin `ghp_…` (hanya tampil sekali).
- Saat menempel token **layar terlihat kosong** — itu normal. Tekan Enter.
- Berhasil bila muncul `Writing objects: 100%` dan `* [new branch] main -> main`.

### C5. Aktifkan GitHub Pages
Repository → **Settings → Pages** → Source: **Deploy from a branch** → Branch: **main** / **(root)** → **Save** → centang **Enforce HTTPS**.
Tunggu 1–2 menit → muncul **"Your site is live at https://USERNAME.github.io/sipl/"**.

> Butuh dipandu langkah demi langkah? Kirim tangkapan layar terminal Anda di percakapan — kami pandu dari titik itu.

---

## Bagian D — Login Pertama & Menyiapkan Data

1. Buka `https://USERNAME.github.io/sipl/` → login `admin` + password dari log setup.
2. **Pengaturan** → ganti password Admin. Unggah **logo** (PNG/JPG maks. 2 MB) bila sudah ada.
3. **Master Data**, isi berurutan:
   1. **Angkatan & Kelas** (mis. *Diktuk Bintara TP 2026 — Kelas A*).
   2. **Peleton** per kelas.
   3. **Mata Pelajaran**.
4. **Personel & Akun → Tambah Akun** untuk setiap Gadik dan Pengasuh, sekaligus pilih kelas/peleton yang diampu.
5. **Jadwal Pelajaran** → isi matriks mingguan per kelas (sistem memperingatkan bentrok).
6. Bagikan alamat aplikasi + username/password awal ke masing-masing personel.
7. Gadik mengisi **Peserta Didik** kelasnya, lalu **Input Nilai**. Pengasuh mengisi **Nilai Mental**.

### Hak akses per peran (ditegakkan server)

| Menu | Admin Satdik | Gadik | Pengasuh |
|---|---|---|---|
| Dashboard | ringkasan semua kelas | kelasnya | peleton binaannya |
| Peserta Didik | lihat semua kelas | tambah/ubah/hapus di kelasnya | lihat peletonnya |
| Personel & Akun, Master Data, Log, Migrasi | ✔ | — | — |
| Jadwal | atur + deteksi bentrok | lihat kelasnya | lihat kelasnya |
| Input Nilai Mapel | — | ✔ kelasnya | — |
| Nilai Mental | — | — | ✔ peletonnya |
| Rekap Nilai | ✔ semua kelas | — | — |
| Pengaturan | password + logo | password | password |

---

## Bagian E — Migrasi Data Lama (modul Migrasi)

Dipakai untuk memindahkan data dari **database SIPL lama** atau **spreadsheet buatan sendiri** (mis. daftar siswa/nilai dari Excel).

1. Excel? Unggah ke Google Drive → buka dengan Google Sheets → salin URL-nya.
   Pastikan akun Google pemilik Apps Script **punya akses baca** ke spreadsheet itu.
2. Login Admin → **Migrasi Data** → tempel URL → centang jenis data → **Pindai (Dry-run)**.
   Pindai hanya menghitung *ditambah / diperbarui / dilewati* dan menampilkan peringatan — **tidak menulis apa pun**.
3. Periksa hasil → **Jalankan Import**.
4. **Delta sync:** tepat sebelum beralih penuh ke aplikasi ini, jalankan import sekali lagi. Hanya data baru yang ditambahkan; nilai diperbarui bila waktu input di sumber lebih baru.

**Nama sheet & kolom yang dikenali** (urutan kolom bebas, huruf besar/kecil & spasi diabaikan):

| Sheet sumber | Kolom contoh |
|---|---|
| `Siswa` / `Peserta` / `Peserta_Didik` | NRP, Nama, Pangkat, Kelas, Peleton |
| `Kelas` / `Angkatan_Kelas` | Angkatan, Kelas, Jenis Pendidikan |
| `Peleton` | Kelas, Peleton |
| `Mapel` / `Mata_Pelajaran` | Mata Pelajaran, Bobot/JP |
| `Users` / `Akun` | Username, Nama, Peran |
| `Gadik` / `Pengasuh` | Username, Nama, Pangkat/NRP, HP |
| `Jadwal` | Kelas, Mapel, Gadik, Hari, Jam Mulai, Jam Selesai, Ruang |
| `Nilai` | NRP, Mapel, Nilai, Waktu (opsional) |
| `Nilai_Mental` | NRP, Nilai, Catatan |

Aturan pengaman:
- Spreadsheet sumber **hanya dibaca**, tidak pernah diubah.
- Aman diulang: data yang sudah ada tidak dibuat ganda (kunci: NRP untuk peserta, username untuk akun, peserta+mapel untuk nilai).
- Akun **Admin** dari sumber tidak diimpor. **Status akun dan password** di aplikasi ini tidak ditimpa.
- NRP yang kehilangan angka 0 di depan (mis. `3051004`) dipulihkan menjadi 8 digit (`03051004`).
- Akun dari sumber yang tidak membawa hash password diberi password acak → **Reset Password** di menu Personel & Akun.
- Sesi login tidak ikut pindah; pengguna cukup login ulang.

---

## Bagian F — Memperbarui Aplikasi

**Backend** (setelah mengganti isi `Kode.gs`/`Migrasi.gs`):
**Terapkan → Kelola deployment → ✏️ Edit → Versi: Versi baru → Terapkan.**
⚠️ Jangan memilih "Deployment baru" — URL `/exec` akan berubah dan frontend terputus.

**Frontend** (setelah mengubah berkas di `sipl-frontend`):
```bash
git add .
git commit -m "Pembaruan"
git push
```
Tunggu 1–2 menit; bila tampilan masih lama tekan **Ctrl + Shift + R**.

---

## Pemeliharaan (fungsi yang bisa dijalankan dari editor Apps Script)

| Fungsi | Kegunaan |
|---|---|
| `resetPasswordAdmin` | Lupa password Admin → password baru tampil di Log eksekusi |
| `bersihkanCache` | Setelah mengedit banyak data langsung di Google Sheets |
| `perbaikiSheet` | Membuat ulang sheet/format kolom yang terhapus (data tetap aman) |
| `pasangTrigger` | Memasang ulang trigger log, cadangan harian, dan penyegar cache |
| `backupHarian` | Membuat cadangan database sekarang juga |

Cadangan otomatis tersimpan di folder **Cadangan Harian** (14 salinan terakhir).

---

## Uji Coba Sebelum Rilis (PRD 8.2)

| Area | Langkah | Hasil yang benar |
|---|---|---|
| Login | password salah 5× | pesan umum, lalu akun terkunci 15 menit |
| Hak akses | login Gadik, buka alamat `#/personel` | dialihkan ke Dashboard |
| Hak akses | login Pengasuh, buka `#/nilai` | dialihkan ke Dashboard |
| Data | Gadik menambah peserta dengan NRP yang sudah ada | ditolak dengan alasan |
| Nilai | ketik 105 | ditandai "Harus 0–100", tidak dikirim |
| Nilai | ketik 85 lalu tunggu 2 detik | status "Tersimpan", muncul di sheet `Nilai` |
| Jadwal | jadwalkan 1 Gadik di 2 kelas pada jam sama | peringatan bentrok |
| Logo | unggah PNG < 2 MB / berkas > 2 MB | yang valid tampil; yang besar ditolak |
| Sesi | biarkan aplikasi diam 60 menit | otomatis keluar |
| Tampilan | buka di HP | menu jadi laci, tabel jadi kartu |

---

## Pemecahan Masalah

| Gejala | Penyebab | Solusi |
|---|---|---|
| Login: "Server belum dihubungkan" | `GAS_URL` belum diisi | Isi `js/config.js` (Bagian B) lalu `git push` |
| Login: "Database belum di-setup" | `setupAppEnvironment` belum dijalankan | Jalankan (Bagian A3) |
| "Koneksi ke server terputus" terus-menerus | Deploy bukan "Siapa saja" / URL salah | Periksa A4; buka URL `/exec` langsung di browser |
| Situs GitHub 404 | `git init` di folder yang salah | Repo harus menampilkan `index.html` di root; push ulang dari `sipl-frontend` |
| Tampilan polos tanpa warna | folder `css`/`js` tidak ikut | Jangan unggah lewat "Upload files"; gunakan `git push` |
| Logo tidak tampil | domain Google membatasi berbagi tautan publik | Pakai akun Google yang mengizinkan "Siapa saja yang memiliki link" |
| Data di Sheets diubah manual tidak muncul | cache server | tunggu ±1 menit atau jalankan `bersihkanCache` |
| "Server sedang melayani banyak pengguna" | puncak penyimpanan bersamaan | aplikasi mencoba ulang otomatis; nilai tetap aman sebagai draf |

**Pengukur kecepatan:** di browser tekan F12 → Console → ketik `Perf.table()` untuk melihat waktu tiap panggilan (`server` = kerja Apps Script, `net` = jaringan + cold start).

---

## Catatan Penting

- **Arsitektur:** sesuai permintaan, aplikasi memakai pola REST API (frontend di GitHub Pages + Apps Script sebagai server JSON), bukan 4 berkas `google.script.run` seperti PRD 7.3. Fungsi dan aturan akses PRD tetap sama.
- **Penyesuaian skema kecil:** kolom `Pangkat` dan `NRP` dipisah (agar NRP bisa dicek duplikatnya), dan kolom `Status` ditambahkan pada `Peleton` dan `Mata_Pelajaran` (agar data yang sudah dipakai bisa dinonaktifkan sesuai US-06).
- **Log aktivitas** dikumpulkan di memori server lalu ditulis ke sheet setiap 1 menit, agar penyimpanan nilai tetap cepat. Setiap baris `Nilai` dan `Nilai_Mental` juga selalu mencatat penginput dan waktunya.
- **Kuota:** dengan "Jalankan sebagai: Saya", seluruh pengguna memakai kuota akun pemilik (± 30 eksekusi bersamaan). Aplikasi dirancang hemat: cache berlapis, satu panggilan per layar, dan simpan nilai per kelompok.
- **Repository publik:** kode tampilan di GitHub terlihat publik, tetapi tidak berisi rahasia apa pun. Data hanya bisa dibaca lewat login di server.
- Aplikasi sudah diuji dengan tiruan layanan Google (177 skenario: login, isolasi kelas, validasi, bentrok jadwal, simpan otomatis, migrasi). Tetap lakukan **Uji Coba Sebelum Rilis** di atas dengan akun Google asli.
