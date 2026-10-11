# Panduan Instalasi SIPL — SPN Polda Papua Barat

**Sistem Informasi Pelatihan** • Versi 1.7.0

> **Sudah memasang versi sebelumnya (1.0 – 1.6)?** Langsung ke **Bagian G — Memperbarui Versi**. Data Anda tetap aman dan database diperbarui otomatis.

### Yang baru di versi 1.7 — progres masuk, tanpa Pengasuh, tipografi elegan
- **Progres persen saat masuk**: setelah tombol *Masuk* ditekan, layar login **diburamkan** dan muncul **logo website** di dalam cincin emas beserta **persentase 0–100 %** dan keterangan tahap (*Menghubungkan ke server → Memverifikasi akun → Memuat data → Selamat datang*). Bila password salah, layar kembali tajam dan pesan kesalahan tampil. Lihat **Bagian L**.
- **Peran Pengasuh dihapus** beserta semua yang berkaitan: menu & halaman *Nilai Mental*, dashboard Pengasuh, pilihan peran Pengasuh di formulir akun, peleton binaan pada penugasan, tab *Nilai Mental* di Rekap Harian, dan impor *Data Pengasuh / Nilai Mental*. Akun yang dapat dibuat kini hanya **Gadik**. Akun Pengasuh dari database lama tidak bisa masuk lagi. Untuk membersihkan sisa datanya dari database, jalankan fungsi **`hapusDataPengasuh`** sekali (lihat **Bagian L**).
- **Tipografi elegan**: judul halaman, judul kartu, angka statistik, nama aplikasi, dan halaman login memakai huruf serif **Playfair Display** dengan aksen emas. Label kecil (eyebrow) berwarna gradasi emas, dan ada garis emas di bawah judul halaman.

### Yang baru di versi 1.6 — jadwal PDF, pas foto, animasi
- **Jadwal Pelatihan (PDF)**: Admin mengunggah PDF jadwal di menu **Jadwal Pelajaran**. Dokumen itu tampil sebagai **kartu ringkasan** di dashboard **Gadik** dan **Pengasuh** (tombol *Buka Jadwal PDF* & *Unduh PDF*). Lihat **Bagian J**.
- **Pas foto 4 × 6 (JPEG/JPG)** untuk akun Admin, Gadik, dan Pengasuh. Foto dipotong otomatis ke ukuran 4 × 6 dan tampil di menu samping, bilah atas, dan daftar personel. Lihat **Bagian K**.
- **Animasi halus**: halaman muncul perlahan, kartu tampil berurutan, angka statistik menghitung naik, kartu terangkat saat disorot, kilau emas pada tombol, dan formulir login meluncur masuk. Animasi otomatis dimatikan bila perangkat diatur *kurangi gerakan* (aksesibilitas).

### Yang baru di versi 1.5 — halaman login baru
- **Halaman login satu layar penuh, tanpa gulir** — di laptop, monitor, tablet, maupun HP (diuji pada 14 ukuran layar, dari 360 × 640 sampai 1920 × 1080).
- **Gambar spanduk SIPL tampil utuh** di kiri, dengan kolom **Username** dan **Password** di kanannya; gambar tidak tertutup formulir. Di HP tegak, gambar di atas dan formulir di bawah.
- Gambar dapat diganti: timpa berkas `img/login-banner.jpg` (lihat **Bagian I**).

### Yang baru di versi 1.4 — jadwal 6 hari & tanda tangan
- **Satu mata pelajaran = 6 hari (Senin–Sabtu).** Di menu Jadwal, satu mapel cukup dibuat **sekali**: pilih tanggal mulai (Senin), tanggal selesai terisi otomatis (Sabtu), dan keenam hari langsung tercentang. Setiap hari menjadi **HARI 1 … HARI 6** di Rekap Akhir.
- **Jam pelaksanaan 08.00–17.00 WIT** (bawaan formulir; jam di luar rentang itu ditolak).
- **Penutupan dimajukan ke Jumat:** centang opsi ini pada jadwal mapel, maka Gadik dapat **mengisi nilai hari Sabtu (HARI 6) sejak hari Jumat**. Dashboard Gadik menampilkan tombol *Isi nilai Sabtu* pada hari Jumat.
- **Kolom tanda tangan Gadik pengampu** di kanan bawah setiap PDF dan Excel (Penilaian Harian, Rekap Harian, Rekap Akhir): kota & tanggal, *GADIK PENGAMPU MATA PELAJARAN*, ruang kosong untuk tanda tangan, nama, dan NRP.
- **Semua unduhan berukuran A4 potrait** (PDF dan pengaturan cetak Excel).
- **Kop di pojok kiri atas** setiap PDF dan sheet Excel: *KEPOLISIAN NEGARA REPUBLIK INDONESIA / DAERAH PAPUA BARAT / SEKOLAH POLISI NEGARA* (bergaris bawah). Teks kop dapat diubah di `js/config.js` → `KOP`.
- **Rekap Akhir per mata pelajaran**: pilih mapel (bawaan: mapel terbaru) sehingga NIL AKHIR dihitung dari 6 hari mapel itu, sama seperti berkas PROLAT. Pilihan *Semua mata pelajaran (gabungan)* tetap tersedia.
- Matriks jadwal Admin kini **per pekan** (◀ ▶ untuk berpindah pekan) dan menampilkan tanggal tiap hari.

### Yang baru di versi 1.3 — tombol Hapus & logo
- **Tombol Hapus di semua tabel**: Personel & Akun, Master Data (Kelas, Peleton, Mata Pelajaran, Penugasan), Jadwal, Peserta Pelatihan (sekarang Admin juga bisa menghapus), Rekap Harian (sesi penilaian dan nilai mental).
- **Hapus berantai, tanpa nonaktifkan**: data yang dihapus beserta **semua data yang berkaitan** langsung terhapus. Contoh: menghapus akun **Gadik** ikut menghapus jadwal mengajarnya, sesi penilaian, dan semua nilai harian mata pelajaran yang ia ajar. Sebelum menghapus, aplikasi menampilkan daftar data yang ikut terhapus (lihat **Bagian H**).
- **Tombol Nonaktifkan dihapus** (juga filter "Status"). Data yang dulu sempat dinonaktifkan di versi lama tetap ditandai **Nonaktif** dengan tombol **Aktifkan** agar bisa dipakai lagi, atau dihapus saja.
- **Logo website bisa diganti** dari menu **Pengaturan** dan langsung tampil di semua perangkat (lihat **Bagian I**).

### Yang baru di versi 1.2 — format penilaian PROLAT
- **Penilaian harian sesuai berkas `PENILAIAN_PROLAT_2026.xlsx`**: kolom NO · NAMA · PANGKAT/NRP · **Aspek Perilaku A1 A2 A3 → JUMLAH** · **Aspek Teori B1 B2 → JUMLAH** · **Aspek Praktek C1 C2 → JUMLAH**. Skor tiap butir **0–10**; JUMLAH terhitung otomatis.
- Menu baru **Rekap Akhir**: daftar kelas → klik kelas → tabel **NIL AKHIR** dan **RANK** seperti sheet *NIL AKHIR*.
- Tombol **Unduh PDF** dan **Unduh Excel** di Input Nilai Harian, Rekap Harian, dan Rekap Akhir. Excel Rekap Akhir berisi sheet **HARI 1 … HARI n + NIL AKHIR lengkap dengan rumus** (=SUM, RANK, COUNTIF), sama seperti berkas asli.
- **Nama peserta selalu urut abjad** (A–Z) di lembar nilai, rekap, dan berkas unduhan.
- Menu Admin *Rekap Nilai* menjadi **Rekap Harian** (lembar per sesi, status sesi + buka kunci, nilai mental).

### Rumus penilaian (dari sheet *NIL AKHIR*)
| Komponen | Rumus |
|---|---|
| JUMLAH Perilaku / Teori / Praktek (per hari) | A1+A2+A3 · B1+B2 · C1+C2 (butir kosong = 0) |
| Nilai aspek (skala 100) | Σ JUMLAH aspek seluruh hari ÷ jumlah hari ÷ banyak butir × 10 |
| **NIL AKHIR** | Perilaku × 30% + Teori × 20% + Praktek × 50% |
| **RANK** | dari NIL AKHIR tertinggi; nilai sama → urutan baris (abjad) |

Catatan: di berkas Excel pembaginya tetap 6 hari; di aplikasi **jumlah hari = sesi yang sudah dikirim ke rekap** (hasilnya sama bila 6 hari). Peserta yang tidak diisi pada sesi yang sudah dikirim dihitung 0 untuk hari itu, sama seperti rumus SUM di Excel. Judul kolom F di berkas asli tertulis "JUMLAH ASPEK TEORI" — di aplikasi diperbaiki menjadi **JUMLAH ASPEK PRAKTEK**.

### Yang baru di versi 1.1
- Aplikasi **khusus Pelatihan**: pilihan *Jenis pendidikan* (Diktuk Bintara/Dikbangspes) dihapus. Semua kelas adalah kelas pelatihan.
- Menu **Log Aktivitas dihapus**. Riwayat perubahan tetap tercatat di sheet `Log_Aktivitas` untuk keperluan audit, tetapi tidak tampil di aplikasi.
- **Input Nilai Harian**: Gadik memilih **tanggal**, lalu memilih **sesi** yang ia ajar hari itu (kartu pilihan berbingkai emas), mengisi nilai seluruh peserta, kemudian menekan **Selesai & Kirim ke Rekap**. Nilai **langsung masuk rekap** dan **terkunci**; hanya Admin yang dapat membuka kunci untuk koreksi.
- Rekap nilai harian dengan daftar sesi penilaian & tombol *Buka kunci* (di v1.2 menjadi **Rekap Harian** + **Rekap Akhir**).
- Gadik yang dijadwalkan mengajar di suatu kelas **otomatis mendapat penugasan** kelas itu, sehingga langsung bisa menginput nilai.

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
   - Folder **📁 SIPL — SPN Polda Papua Barat** berisi spreadsheet database (15 sheet), folder **Logo Aplikasi**, dan folder **Cadangan Harian**.
   - Pemicu (*trigger*) otomatis: penulisan log tiap 1 menit, cadangan database tiap pukul 02.00 WIT, dan penyegar cache saat Sheets diedit manual.

> ⚠️ Jangan menjalankan `setupAppEnvironment` lebih dari sekali. Bila dijalankan lagi, setup akan menolak agar tidak membuat database ganda.

**Opsional — data contoh untuk uji coba:** pilih fungsi `isiDataContoh` → ▶ Jalankan. Ini mengisi 2 kelas, 4 peleton, 4 mapel, 2 Gadik (`bambang` dan `irwan`, password `gadik12345`), 4 sesi jadwal, dan 24 peserta. **Pakai hanya untuk instalasi uji coba** — akun contoh memiliki password yang tertulis di panduan ini. Untuk instalasi sungguhan, lewati langkah ini.

### A4. Deploy sebagai Web App
1. Klik **Terapkan (Deploy)** → **Deployment baru**.
2. Klik ⚙️ di samping "Pilih jenis" → **Aplikasi web**.
3. Isi:
   - **Deskripsi:** `SIPL v1.3`
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
2. **Pengaturan** → ganti password Admin. Ganti **logo website** bila sudah ada (Bagian I).
3. **Master Data**, isi berurutan:
   1. **Angkatan & Kelas** (mis. *Pelatihan Gelombang I 2026 — Kelas A*).
   2. **Peleton** per kelas.
   3. **Mata Pelajaran**.
4. **Personel & Akun → Tambah Akun** untuk setiap Gadik, sekaligus pilih kelas yang diampu.
5. **Jadwal Pelajaran → Tambah Jadwal Mapel**, untuk setiap mata pelajaran:
   - pilih **Kelas**, **Mata pelajaran**, **Gadik pengampu**;
   - **Tanggal mulai** (Senin) — tanggal selesai otomatis Sabtu (6 hari); hari pelaksanaan Senin–Sabtu sudah tercentang;
   - jam **08.00–17.00** (bawaan), ruang (opsional);
   - centang **Penutupan dimajukan ke hari Jumat** bila penutupan mapel itu dimajukan.

   Mapel berikutnya dijadwalkan di pekan berikutnya. Sistem memperingatkan bila kelas atau Gadik yang sama dijadwalkan pada tanggal & jam yang sama. Jadwal inilah yang menentukan mapel yang muncul di Input Nilai Harian milik Gadik pada tiap tanggal.
6. Bagikan alamat aplikasi + username/password awal ke masing-masing personel.
7. Gadik mengisi **Peserta Pelatihan** kelasnya, lalu **Input Nilai Harian** setiap selesai mengajar.

### Alur Input Nilai Harian (Gadik)

| Langkah | Yang dilakukan | Keterangan |
|---|---|---|
| 1 | Buka **Input Nilai Harian** → pilih **tanggal** | Bawaan: hari ini. Ada tombol *Hari ini* / *Kemarin*. Tanggal yang belum tiba ditolak — kecuali **Sabtu** pada hari **Jumat** bila jadwal mapel itu dicentang *Penutupan dimajukan ke Jumat* (muncul tombol *Sabtu*). |
| 2 | Pilih **sesi** pada kartu pilihan | Hanya mapel yang Anda ampu pada tanggal itu (kartu menampilkan *HARI n / 6*). Bila hanya satu, langsung terpilih. |
| 3 | Isi skor **A1–C2 (0–10)** tiap peserta | JUMLAH tiap aspek terhitung seketika. Tersimpan otomatis sebagai **draf** ±1,5 detik setelah berhenti mengetik. **Enter** = butir berikutnya, **↑ ↓** = peserta atas/bawah. Di HP, tiap peserta tampil sebagai kartu. |
| 4 | Tekan **Selesai & Kirim ke Rekap** | Muncul konfirmasi jumlah terisi/kosong. Setelah dikirim, nilai **langsung masuk rekap** dan **terkunci**. |

- Nilai yang masih **draf tidak dihitung** di rekap. Dashboard Gadik mengingatkan sesi yang belum dikirim.
- Perlu koreksi setelah dikirim? Admin membuka **Rekap Harian → Penilaian Harian → Buka kunci** dan menuliskan alasannya. Gadik melihat alasan itu, memperbaiki nilai, lalu menekan **Selesai & Kirim ke Rekap** lagi.
- Setiap hari yang dikirim menjadi satu **HARI** di Rekap Akhir mapel itu (HARI 1 = Senin … HARI 6 = Sabtu). Bila satu kelas punya dua sesi mapel yang sama pada tanggal yang sama, keduanya tampil sebagai *HARI n-1* dan *HARI n-2*.
- PDF/Excel yang diunduh berukuran **A4 potrait** dan memuat **kolom tanda tangan Gadik pengampu** di kanan bawah — tinggal dicetak lalu ditandatangani. Kota pada kolom tanda tangan diatur di `js/config.js` (`KOTA: 'Manokwari'`).
- Tombol **Unduh PDF / Unduh Excel** di atas lembar menghasilkan lembar format *HARI* seperti berkas asli (Excel lengkap dengan rumus JUMLAH).

### Rekap Akhir (Admin & Gadik)
1. Buka menu **Rekap Akhir** → muncul kartu tiap kelas (Gadik hanya melihat kelas penugasannya).
2. Klik kelas → pilih **Mata pelajaran** (bawaan: mapel terbaru) → tabel **NO · NAMA · PANGKAT/NRP · JUMLAH ASPEK PERILAKU · TEORI · PRAKTEK · NIL AKHIR · RANK** dari 6 hari mapel itu. Pilih urutan **Abjad** atau **Peringkat**; klik baris untuk rincian per hari.
3. **Unduh Excel** → berkas berisi sheet *HARI 1 … HARI 6* dan *NIL AKHIR* dengan rumus aktif. **Unduh PDF** → tabel NIL AKHIR siap cetak (A4 potrait). Keduanya memuat kolom tanda tangan Gadik pengampu.

### Hak akses per peran (ditegakkan server)

| Menu | Admin Satdik | Gadik |
|---|---|---|
| Dashboard | ringkasan semua kelas | kelasnya |
| Peserta Pelatihan | lihat + hapus semua kelas | tambah/ubah/hapus di kelasnya |
| Personel & Akun, Master Data, Migrasi | ✔ | — |
| Jadwal | atur + deteksi bentrok | lihat kelasnya |
| Input Nilai Harian (+ unduh lembar) | — | ✔ sesi yang ia ajar |
| Rekap Harian + Buka kunci / Hapus sesi | ✔ semua kelas | — |
| Rekap Akhir (+ unduh PDF/Excel) | ✔ semua kelas | ✔ kelasnya |
| Pengaturan | password + logo + pas foto | password + pas foto |

Sejak v1.7 hanya ada dua peran: **Admin Satdik** dan **Gadik**.

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
| `Kelas` / `Angkatan_Kelas` | Angkatan / Gelombang, Kelas |
| `Peleton` | Kelas, Peleton |
| `Mapel` / `Mata_Pelajaran` | Mata Pelajaran, Bobot/JP |
| `Users` / `Akun` | Username, Nama, Peran |
| `Gadik` | Username, Nama, Pangkat/NRP, HP |
| `Jadwal` | Kelas, Mapel, Gadik, Hari (mis. `Senin - Sabtu` atau `Senin, Selasa`), Jam Mulai, Jam Selesai, Ruang, Tanggal Mulai, Tanggal Selesai, Tutup Jumat (Ya/kosong). Jadwal tanpa tanggal dianggap jadwal lama yang berulang tiap pekan. |
| `Nilai` / `Nilai_Harian` | NRP, Mapel, **A1 A2 A3 B1 B2 C1 C2** (0–10) — atau satu kolom **Nilai** (0–100) — Tanggal (opsional), Waktu (opsional) |
| `Sesi_Nilai` (database SIPL 1.1/1.2) | semua kolom asli |

Aturan pengaman:
- Spreadsheet sumber **hanya dibaca**, tidak pernah diubah.
- Aman diulang: data yang sudah ada tidak dibuat ganda (kunci: NRP untuk peserta, username untuk akun, peserta+mapel+tanggal untuk nilai).
- Nilai hasil import **langsung dihitung di rekap**. Bila kolom Tanggal kosong, dipakai tanggal dari kolom Waktu (atau tanggal import).
- Sumber yang hanya punya satu angka **Nilai** 0–100 diimpor sebagai butir A1–C2 = Nilai ÷ 10, sehingga nilai akhirnya tetap sama.
- Akun **Admin** dan akun **Pengasuh** dari sumber tidak diimpor (peran Pengasuh sudah dihapus). Sheet *Data Pengasuh* / *Nilai Mental* di sumber diabaikan.
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

## Bagian G — Memperbarui Versi (1.0 – 1.6 → 1.7)

Lakukan saat aplikasi sepi (mis. sore hari). Data lama **tidak dihapus**. Langkahnya sama dari versi mana pun.

**1. Backend**
1. Buka proyek **SIPL Backend** di script.google.com.
2. Berkas **Kode** → hapus seluruh isinya → tempel isi `Kode.gs` versi terbaru. Lakukan hal yang sama untuk **Migrasi** (`Migrasi.gs`). Tekan **Ctrl + S**.
3. **Terapkan → Kelola deployment → ✏️ Edit → Versi: Versi baru → Terapkan.** (URL `/exec` tetap sama.)
4. Database diperbarui **otomatis** pada permintaan pertama (mis. saat ada yang login). Pembaruan ini:
   - (v1.7) tidak membuat sheet baru; sheet lama `Data_Pengasuh` & `Nilai_Mental` tidak dipakai lagi dan **tidak dihapus otomatis** (bersihkan dengan `hapusDataPengasuh` bila diinginkan — Bagian L),
   - membuat sheet **`Dokumen_Jadwal`** dan **`Foto_Akun`**, serta kolom **`Foto_Ver`** di sheet `Users` (v1.6),
   - menambah kolom **`Tanggal_Mulai`**, **`Tanggal_Selesai`**, **`Tutup_Jumat`** di sheet `Jadwal`,
   - membuat sheet baru **`Sesi_Nilai`** (status tiap sesi penilaian: Draf/Selesai) bila belum ada, dan **`Logo_Aplikasi`** (tempat menyimpan logo),
   - menambah kolom **`Tanggal`**, **`ID_Jadwal`**, dan **`A1 A2 A3 B1 B2 C1 C2`** di sheet `Nilai`,
   - memberi tanggal pada nilai lama (diambil dari `Waktu_Input`),
   - mengubah nilai lama yang hanya satu angka (format 1.0/1.1) menjadi butir A1–C2 = nilai ÷ 10, sehingga nilai akhirnya tetap sama dan ikut dihitung di Rekap Akhir.

   Boleh juga dijalankan manual lebih dulu: pilih fungsi **`perbaikiSheet`** → ▶ **Jalankan** (aman diulang).

**2. Frontend**
1. Simpan dulu nilai `GAS_URL` dari `js/config.js` lama Anda.
2. Ekstrak `sipl-frontend.zip` versi 1.7, lalu **salin seluruh isinya menimpa** isi folder repository lama Anda (`index.html`, `css`, `js`, `img`, dan berkas `.md`).
3. Buka `js/config.js` yang baru → isi kembali `GAS_URL` yang tadi disimpan.
4. Kirim ke GitHub:
   ```bash
   git add .
   git commit -m "SIPL 1.7 - progres login, tanpa Pengasuh, tipografi elegan"
   git push
   ```
5. Tunggu 1–2 menit. Berkas versi baru otomatis dimuat (tidak perlu hapus cache); bila tampilan masih lama, tekan **Ctrl + Shift + R**.

**Catatan pembaruan**
- **v1.7**: akun Pengasuh lama tidak dapat masuk lagi. Beritahukan kepada para Pengasuh bila perlu. Huruf *Playfair Display* dimuat dari Google Fonts; bila jaringan memblokirnya, judul memakai huruf serif bawaan perangkat (Georgia/Times) dan tampilan tetap rapi.
- **Jadwal lama** (dibuat sebelum v1.4, berulang tiap pekan tanpa tanggal) **tetap berjalan** dan ditandai *Format lama* di tampilan Daftar. Saat diubah, lengkapi tanggal pelaksanaan dan jam 08.00–17.00. Untuk mapel berikutnya, buat jadwal baru dengan tanggal mulai — lalu hapus jadwal lama bila sudah tidak dipakai (hati-hati: nilai sesi jadwal itu ikut terhapus).
- **Logo lama (v1.0–1.2)** yang diunggah lewat Google Drive tetap tampil. Untuk memakai cara penyimpanan baru (lebih andal), unggah ulang logo di **Pengaturan**.
- Kolom `Jenis_Pendidikan` di sheet `Angkatan_Kelas` tidak dipakai lagi. Boleh dibiarkan atau dihapus manual.
- Gadik yang sudah terjadwal di suatu kelas tetapi belum punya penugasan di kelas itu akan otomatis ditugaskan saat Admin menyimpan ulang jadwalnya. Periksa **Master Data → Penugasan** bila ada Gadik yang tidak melihat sesinya.

---

## Bagian H — Menghapus Data (Hapus Berantai)

Semua tabel punya tombol **🗑 Hapus** di kolom **Aksi**. Tidak ada lagi tombol *Nonaktifkan*: data yang dihapus beserta seluruh data yang berkaitan langsung terhapus.

**Cara kerja tombol Hapus**
1. Tekan 🗑 pada baris yang ingin dihapus.
2. Aplikasi memeriksa ke server lalu menampilkan **daftar data yang ikut terhapus** beserta jumlahnya (mis. *2 sesi jadwal • 2 sesi penilaian harian • 24 baris nilai harian*).
3. Bila ada **nilai** yang ikut terhapus, centang **"Saya mengerti — data yang dihapus tidak dapat dikembalikan"** agar tombol **Hapus Permanen** aktif.
4. Tekan **Hapus Permanen**. Tabel, dashboard, Rekap Harian, dan Rekap Akhir langsung diperbarui.

**Data apa saja yang ikut terhapus**

| Yang dihapus | Ikut terhapus |
|---|---|
| **Akun Gadik** (Personel & Akun) | data Gadik, penugasan, **semua jadwal mengajarnya**, sesi penilaian & **nilai harian mata pelajaran yang ia ajar**. Sesi login Gadik itu langsung berakhir. |
| **Kelas** (Master Data) | peleton, peserta, jadwal, penugasan, sesi penilaian, dan nilai harian di kelas itu |
| **Peleton** | peserta di peleton itu beserta nilainya |
| **Mata Pelajaran** | semua jadwal mapel itu, sesi penilaian, dan nilai hariannya |
| **Penugasan** | hanya penugasan itu (Gadik tidak lagi melihat kelas tersebut) |
| **Jadwal** | sesi penilaian & nilai harian dari jadwal itu |
| **Peserta** (Admin, atau Gadik di kelasnya) | nilai harian peserta itu. Jumlah "Dinilai" tiap sesi dihitung ulang. |
| **Sesi penilaian** (Rekap Harian) | semua nilai harian sesi itu, sehingga hari itu keluar dari Rekap Akhir |

**Pengaman**
- Akun Admin tidak bisa dihapus. Gadik hanya bisa menghapus peserta di kelas penugasannya.
- Bila tombol Hapus tertekan dua kali atau koneksi putus, data tidak terhapus dua kali.
- **Salah hapus?** Database dicadangkan otomatis setiap hari pukul 02.00 WIT di folder **Cadangan Harian** (14 salinan terakhir). Buka salinan terbaru, lalu salin baris yang terhapus ke database. Untuk menghapus data dalam jumlah besar, jalankan dulu `backupHarian` di editor Apps Script agar cadangannya paling baru.

---

## Bagian I — Mengganti Logo Website

Logo tampil di **halaman login**, **layar progres masuk** (di tengah cincin emas), **menu samping**, dan **ikon tab browser**.

### Cara 1 — lewat aplikasi (disarankan)
1. Masuk sebagai **Admin** → menu **Pengaturan** → kartu **Logo Website**.
2. Tekan **Pilih berkas atau seret logo ke sini**, lalu pilih gambar logo (**PNG, JPG, WEBP, atau SVG**, maks. 5 MB).
3. Periksa **pratinjau**: tampak di menu dan halaman login.
4. Tekan **Simpan Logo**. Logo langsung berganti di semua perangkat. Perangkat lain memperbaruinya saat dibuka atau dimuat ulang.
5. Untuk kembali ke logo perisai bawaan, tekan **Kembalikan Logo Bawaan**.

**Tips agar logo rapi**
- Gunakan gambar **persegi (1:1)**, minimal **256 × 256 piksel**. Logo yang tidak persegi tetap bisa dipakai, tetapi ada ruang kosong di sisinya.
- Pakai latar **transparan** (PNG) atau **putih**. Logo ditampilkan di dalam lingkaran pada halaman login, jadi beri sedikit ruang di tepinya.
- Tidak perlu mengecilkan berkas sendiri: aplikasi memperkecilnya otomatis ke 256 px sebelum disimpan.
- Logo disimpan langsung di database (sheet `Logo_Aplikasi`), **tidak lewat berbagi Google Drive**, jadi tetap tampil walau domain Google Anda membatasi berbagi tautan publik.

### Mengganti gambar halaman login
1. Siapkan gambar mendatar (disarankan ± 1500 × 1060 piksel, JPG, < 400 KB).
2. Simpan dengan nama **`login-banner.jpg`** di folder **`img`** (timpa berkas lama).
3. `git add .` → `git commit -m "Ganti gambar login"` → `git push`, lalu buka web dan tekan **Ctrl + Shift + R**.

Gambar selalu ditampilkan utuh (tidak dipotong) dan formulir login berada di sampingnya, sehingga gambar tidak tertutup.

### Cara 2 — logo bawaan dari berkas (opsional)
Dipakai bila Admin belum mengunggah logo, misalnya agar logo instansi langsung tampil sejak instalasi pertama.
1. Simpan logo di folder **`img`** pada repository dengan nama **`logo.png`**.
2. Buka **`js/config.js`** → ubah `LOGO: ''` menjadi `LOGO: 'img/logo.png'`.
3. Kirim ke GitHub:
   ```bash
   git add .
   git commit -m "Ganti logo bawaan"
   git push
   ```
Logo dari **Pengaturan** (Cara 1) selalu diutamakan. Urutannya: logo dari Pengaturan, lalu `LOGO` di `config.js`, lalu ikon perisai.

---

## Bagian J — Jadwal Pelatihan (PDF) di Dashboard

**Admin mengunggah**
1. Menu **Jadwal Pelajaran** → kartu **Jadwal Pelatihan** → **Unggah PDF Jadwal**.
2. Isi **Judul** (terisi otomatis dari nama berkas), pilih **Ditujukan untuk**: *Semua kelas (umum)* atau satu kelas tertentu.
3. Pilih berkas **PDF** (maks. 10 MB) → **Unggah**.

Tombol ✏️ untuk mengubah judul/kelas atau mengganti berkas, 🗑 untuk menghapus. Berkas disimpan di folder Google Drive **📂 Dokumen Jadwal Pelatihan** (dibuat otomatis saat unggahan pertama) dan **tidak perlu dibagikan publik**: aplikasi mengirimkannya hanya kepada pengguna yang sudah login.

**Gadik melihat**
- Dashboard menampilkan kartu ringkasan **Jadwal Pelatihan (PDF)** berisi dokumen terbaru → **Buka Jadwal PDF** (penampil PDF di dalam aplikasi) atau **Unduh PDF**. Bila ada beberapa dokumen, tombol *Semua dokumen* menampilkan daftarnya.
- Di HP, PDF dibuka dengan penampil PDF bawaan HP (tombol *Buka PDF*).
- Gadik hanya melihat dokumen **umum** dan dokumen untuk **kelas penugasannya**. Dokumen yang sama juga tampil di menu **Jadwal Pelajaran** mereka.

---

## Bagian K — Pas Foto 4 × 6

- **Foto sendiri** (Admin & Gadik): menu **Pengaturan** → kartu **Pas Foto 4 × 6** → **Ganti Pas Foto**.
- **Foto akun lain** (khusus Admin): **Personel & Akun** → tombol 📷 pada baris akun, atau buka formulir **Ubah akun** → klik kotak **Pas Foto 4×6**.

Ketentuan: format **JPEG/JPG** saja (PNG ditolak). Foto otomatis **dipotong ke rasio 4 × 6 (potret)** dan diperkecil menjadi 400 × 600 piksel sebelum disimpan; geser slider **Geser posisi foto** bila wajah kurang di tengah. Pas foto tampil di menu samping, bilah atas, daftar personel, dan penugasan. Tombol **Hapus Foto** mengembalikan tampilan inisial nama. Menghapus akun ikut menghapus pas fotonya.

---

## Bagian L — Progres Masuk & Penghapusan Peran Pengasuh (v1.7)

**Progres saat masuk**
1. Isi username & password → **Masuk ke Aplikasi**.
2. Layar login langsung **diburamkan**. Di tengah layar tampil **logo website** (logo yang diatur di *Pengaturan → Logo Website*, atau perisai bawaan) di dalam cincin emas, angka **persen**, bilah progres, dan keterangan tahap:
   | Persen | Tahap |
   |---|---|
   | 0–30 % | Menghubungkan ke server SIPL |
   | 30–70 % | Memverifikasi akun & kata sandi |
   | 70–95 % | Memuat data kelas / modul administrator |
   | 100 % | *Selamat datang, (nama)* → dashboard terbuka, efek buram memudar |
3. Bila username/password salah atau server tidak terjangkau, progres ditutup, layar kembali tajam, dan pesan kesalahan tampil di atas formulir.
4. Pada perangkat yang diatur **kurangi gerakan**, persen tetap tampil tanpa animasi.

**Peran Pengasuh sudah dihapus**
- Di aplikasi: menu **Nilai Mental**, dashboard Pengasuh, pilihan peran Pengasuh, peleton binaan, tab Nilai Mental di Rekap Harian, dan impor data Pengasuh/Nilai Mental sudah tidak ada.
- Akun Pengasuh lama tidak dapat masuk (pesan: *Peran Pengasuh sudah tidak digunakan di SIPL*). Sesi Pengasuh yang masih terbuka di perangkat langsung dikembalikan ke halaman login.
- Data lama **tidak dihapus otomatis**. Untuk membersihkannya: buka editor Apps Script → pilih fungsi **`hapusDataPengasuh`** → ▶ **Jalankan**. Fungsi ini menghapus akun ber-peran Pengasuh beserta penugasan & pas fotonya, lalu menghapus sheet `Data_Pengasuh` dan `Nilai_Mental`. Bila ingin menyimpan arsip nilai mental, unduh dulu sheet `Nilai_Mental` (File → Download → Excel) sebelum menjalankan fungsi ini.

---

## Pemeliharaan (fungsi yang bisa dijalankan dari editor Apps Script)

| Fungsi | Kegunaan |
|---|---|
| `resetPasswordAdmin` | Lupa password Admin → password baru tampil di Log eksekusi |
| `bersihkanCache` | Setelah mengedit banyak data langsung di Google Sheets |
| `perbaikiSheet` | Membuat ulang sheet/kolom/format yang hilang (data tetap aman). Juga dipakai saat memperbarui dari v1.0 |
| `pasangTrigger` | Memasang ulang trigger log, cadangan harian, dan penyegar cache |
| `backupHarian` | Membuat cadangan database sekarang juga |
| `hapusDataPengasuh` | (v1.7, opsional, sekali saja) menghapus sisa akun Pengasuh beserta penugasan & pas fotonya, lalu sheet `Data_Pengasuh` dan `Nilai_Mental` dari database lama |

Cadangan otomatis tersimpan di folder **Cadangan Harian** (14 salinan terakhir).

---

## Uji Coba Sebelum Rilis (PRD 8.2)

| Area | Langkah | Hasil yang benar |
|---|---|---|
| Login | password salah 5× | pesan umum, lalu akun terkunci 15 menit |
| Hak akses | login Gadik, buka alamat `#/personel` | dialihkan ke Dashboard |
| Login | masukkan username & password benar → **Masuk** | layar login buram, logo + persen 0–100 % tampil, lalu dashboard terbuka |
| Hak akses | login dengan akun Pengasuh lama | ditolak: *Peran Pengasuh sudah tidak digunakan* |
| Data | Gadik menambah peserta dengan NRP yang sudah ada | ditolak dengan alasan |
| Nilai | Gadik membuka Input Nilai Harian pada hari mengajar | hanya sesi miliknya yang tampil sebagai kartu pilihan |
| Nilai | ketik 12 pada butir A1 | ditandai "Harus 0–10", tidak dikirim |
| Nilai | isi A1–C2 satu peserta | JUMLAH tiap aspek langsung terhitung; status "Lengkap" |
| Nilai | isi skor lalu tunggu 2 detik | status bar "Draf tersimpan", baris muncul di sheet `Nilai` (kolom A1–C2) beserta tanggalnya |
| Nilai | buka Rekap sebelum Gadik menekan Selesai | nilai draf belum dihitung |
| Nilai | Gadik menekan **Selesai & Kirim ke Rekap** | nilai muncul di Rekap; kolom nilai Gadik terkunci |
| Nilai | Admin: Rekap Harian → **Buka kunci** | sesi kembali Draf; Gadik melihat alasannya dan bisa koreksi |
| Rekap Akhir | buka kelas → **Unduh Excel** | berkas berisi sheet HARI 1…n + NIL AKHIR; nilai di Excel sama dengan layar |
| Rekap Akhir | **Unduh PDF** | tabel NIL AKHIR + RANK siap cetak |
| Jadwal | Tambah Jadwal Mapel | 6 hari Senin–Sabtu tercentang, jam 08.00–17.00, tanggal selesai = Sabtu |
| Jadwal | isi jam mulai 07.00 | ditolak: pelaksanaan 08.00–17.00 |
| Jadwal | jadwalkan 1 Gadik di 2 kelas pada pekan yang sama | peringatan bentrok |
| Penutupan Jumat | centang opsi di jadwal, login Gadik hari Jumat | dashboard menampilkan *Isi nilai Sabtu*; lembar HARI 6 bisa diisi |
| Unduh | Unduh PDF lembar harian / Rekap Akhir | A4 potrait, kolom tanda tangan Gadik di kanan bawah |
| Jadwal PDF | Admin unggah PDF jadwal → login Gadik | kartu *Jadwal Pelatihan (PDF)* di dashboard; PDF bisa dibuka & diunduh |
| Pas foto | Pengaturan → Ganti Pas Foto (JPG) | foto 4 × 6 tampil di menu & bilah atas; PNG ditolak |
| Logo | Pengaturan → pilih logo → Simpan Logo | logo tampil di menu, halaman login, dan ikon tab; buka di HP → logo sama |
| Hapus | Master Data → Mata Pelajaran → 🗑 pada mapel yang sudah dinilai | dialog menampilkan jadwal & nilai yang ikut terhapus; tombol aktif setelah dicentang |
| Hapus | Personel → 🗑 akun Gadik | jadwal & nilai mapelnya ikut hilang dari Jadwal dan Rekap; Gadik tidak bisa login |
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
| PDF jadwal tidak muncul di dashboard Gadik | dokumen ditujukan untuk kelas lain | Admin: Jadwal → ✏️ dokumen → *Ditujukan untuk* = kelas yang benar atau *Semua kelas* |
| "Berkas PDF tidak ditemukan di Google Drive" | berkas di folder Dokumen Jadwal terhapus manual | Admin mengunggah ulang berkasnya (✏️ → pilih PDF) |
| Pas foto ditolak "harus berformat JPEG/JPG" | foto berformat PNG/HEIC | simpan ulang sebagai JPG (mis. dari aplikasi Galeri/Paint) lalu unggah lagi |
| Logo tidak berganti di perangkat lain | tampilan lama masih tersimpan | muat ulang halaman (**Ctrl + Shift + R**, HP: tutup & buka lagi) |
| Logo lama (dari v1.2) tidak tampil | domain Google membatasi berbagi tautan publik | unggah ulang logo di **Pengaturan**; versi 1.3 tidak lagi memakai berbagi Drive |
| "Logo terlalu besar untuk disimpan" | tampilan lama mengirim gambar asli | muat ulang halaman lalu unggah lagi |
| Data di Sheets diubah manual tidak muncul | cache server | tunggu ±1 menit atau jalankan `bersihkanCache` |
| "Server sedang melayani banyak pengguna" | puncak penyimpanan bersamaan | aplikasi mencoba ulang otomatis; nilai tetap aman sebagai draf |
| `Sheet "Sesi_Nilai" tidak ditemukan di database` | database belum diperbarui | Jalankan **`perbaikiSheet`** sekali di editor Apps Script, atau pasang `Kode.gs` terbaru (memperbarui database otomatis) lalu **Versi baru** |
| Gadik: "Tidak ada mapel Anda pada …" | tanggal itu di luar jadwal mapel Gadik | pilih tanggal dari tombol yang tersedia, atau Admin menambah jadwal mapel di **Jadwal Pelajaran** |
| Gadik tidak bisa mengisi nilai Sabtu pada hari Jumat | jadwal mapel belum dicentang *Penutupan dimajukan ke Jumat* | Admin: Jadwal → klik mapel → centang opsi → Simpan |
| Menyimpan jadwal lama: "Isi tanggal mulai pelaksanaan mapel" | jadwal format lama belum punya tanggal | isi tanggal mulai (Senin) dan jam 08.00–17.00 |
| Nama/NRP di kolom tanda tangan kosong | data Gadik belum punya NRP atau sesi tanpa Gadik | lengkapi NRP di **Personel & Akun**; untuk gabungan beberapa Gadik, kolom nama dibiarkan kosong untuk diisi tangan |
| Nilai sudah diisi tetapi tidak muncul di Rekap | sesi masih **Draf** | Gadik menekan **Selesai & Kirim ke Rekap** (lihat daftar sesi di Rekap Harian) |
| "Versi aplikasi di perangkat Anda sudah usang" | tampilan lama masih terbuka setelah pembaruan | tekan **Ctrl + Shift + R** (HP: tutup & buka lagi), lalu isi ulang baris itu |
| Console: `Cannot read properties of undefined (reading 'JDW-…')`, lembar nilai tidak tampil | data lama dari versi sebelumnya tersimpan di browser | sudah diperbaiki di tampilan **1.3.1** (data lama diabaikan & diambil ulang otomatis). Pasang ZIP terbaru, lalu **Ctrl + Shift + R** |
| Muncul "Server belum diperbarui" (Admin) | `Kode.gs` di Apps Script lebih lama dari tampilan | tempel `Kode.gs` & `Migrasi.gs` terbaru → **Terapkan → Kelola deployment → Edit → Versi baru** |
| Tombol Unduh tidak menghasilkan berkas | koneksi terputus saat modul unduh pertama kali dimuat | periksa koneksi lalu tekan lagi |
| Gadik tidak bisa mengubah nilai | sesi sudah dikirim & terkunci | Admin: Rekap → Sesi Penilaian → **Buka kunci** |
| Mapel jadwal tidak bisa diganti | sesi itu sudah punya nilai harian | ubah jam/hari/Gadik saja, buat sesi jadwal baru, atau hapus jadwalnya (nilainya ikut terhapus) |
| "Aksi tidak dikenal: …Delete" | tampilan versi lama masih terbuka | tekan **Ctrl + Shift + R** |

**Pengukur kecepatan:** di browser tekan F12 → Console → ketik `Perf.table()` untuk melihat waktu tiap panggilan (`server` = kerja Apps Script, `net` = jaringan + cold start).

---

## Catatan Penting

- **Arsitektur:** sesuai permintaan, aplikasi memakai pola REST API (frontend di GitHub Pages + Apps Script sebagai server JSON), bukan 4 berkas `google.script.run` seperti PRD 7.3. Fungsi dan aturan akses PRD tetap sama.
- **Penyesuaian skema kecil:** kolom `Pangkat` dan `NRP` dipisah (agar NRP bisa dicek duplikatnya), dan kolom `Status` ada pada `Peleton` dan `Mata_Pelajaran`. Sejak v1.3 fitur nonaktifkan dihapus atas permintaan pengguna; kolom `Status` hanya dipakai untuk data lama yang masih berstatus Nonaktif.
- **Riwayat perubahan** (login, nilai, kirim ke rekap, buka kunci, akun, jadwal) tetap ditulis ke sheet `Log_Aktivitas` setiap 1 menit untuk audit, tetapi tidak lagi ditampilkan sebagai menu. Setiap baris `Nilai` dan `Nilai_Mental` juga mencatat penginput dan waktunya; `Sesi_Nilai` mencatat siapa dan kapan sesi dikirim ke rekap.
- **Kuota:** dengan "Jalankan sebagai: Saya", seluruh pengguna memakai kuota akun pemilik (± 30 eksekusi bersamaan). Aplikasi dirancang hemat: cache berlapis, satu panggilan per layar, dan simpan nilai per kelompok.
- **Repository publik:** kode tampilan di GitHub terlihat publik, tetapi tidak berisi rahasia apa pun. Data hanya bisa dibaca lewat login di server.
- Aplikasi sudah diuji dengan tiruan layanan Google (429 skenario: jadwal PDF & pas foto, login, isolasi kelas, jadwal 6 hari & bentrok per tanggal, penutupan Jumat, PDF/Excel A4 potrait bertanda tangan, hapus berantai semua jenis data, logo, lembar A1–C2, kunci & buka kunci, Rekap Akhir & RANK, berkas unduhan dibuka ulang dengan LibreOffice, bentrok jadwal, simpan otomatis, migrasi, pembaruan otomatis dari v1.0/1.1) dan diperiksa tampilannya di Chromium (desktop & HP). Tetap lakukan **Uji Coba Sebelum Rilis** di atas dengan akun Google asli.
