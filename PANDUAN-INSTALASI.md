# Panduan Instalasi SIPL — SPN Polda Papua Barat

**Sistem Informasi Pelatihan** • Versi 1.2.0

> **Sudah memasang versi 1.0 atau 1.1?** Langsung ke **Bagian G — Memperbarui Versi**. Data Anda tetap aman dan database diperbarui otomatis.

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
   - Folder **📁 SIPL — SPN Polda Papua Barat** berisi spreadsheet database (14 sheet), folder **Logo Aplikasi**, dan folder **Cadangan Harian**.
   - Pemicu (*trigger*) otomatis: penulisan log tiap 1 menit, cadangan database tiap pukul 02.00 WIT, dan penyegar cache saat Sheets diedit manual.

> ⚠️ Jangan menjalankan `setupAppEnvironment` lebih dari sekali. Bila dijalankan lagi, setup akan menolak agar tidak membuat database ganda.

**Opsional — data contoh untuk uji coba:** pilih fungsi `isiDataContoh` → ▶ Jalankan. Ini mengisi 2 kelas, 4 peleton, 4 mapel, 2 Gadik (`bambang` / `gadik12345`), 2 Pengasuh (`hendra` / `pengasuh123`), 4 sesi jadwal, dan 24 peserta. **Pakai hanya untuk instalasi uji coba** — akun contoh memiliki password yang tertulis di panduan ini. Untuk instalasi sungguhan, lewati langkah ini.

### A4. Deploy sebagai Web App
1. Klik **Terapkan (Deploy)** → **Deployment baru**.
2. Klik ⚙️ di samping "Pilih jenis" → **Aplikasi web**.
3. Isi:
   - **Deskripsi:** `SIPL v1.2`
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
   1. **Angkatan & Kelas** (mis. *Pelatihan Gelombang I 2026 — Kelas A*).
   2. **Peleton** per kelas.
   3. **Mata Pelajaran**.
4. **Personel & Akun → Tambah Akun** untuk setiap Gadik dan Pengasuh, sekaligus pilih kelas/peleton yang diampu.
5. **Jadwal Pelajaran** → isi matriks mingguan per kelas (sistem memperingatkan bentrok). Jadwal inilah yang menentukan **sesi** yang muncul di Input Nilai Harian milik Gadik.
6. Bagikan alamat aplikasi + username/password awal ke masing-masing personel.
7. Gadik mengisi **Peserta Pelatihan** kelasnya, lalu **Input Nilai Harian** setiap selesai mengajar. Pengasuh mengisi **Nilai Mental**.

### Alur Input Nilai Harian (Gadik)

| Langkah | Yang dilakukan | Keterangan |
|---|---|---|
| 1 | Buka **Input Nilai Harian** → pilih **tanggal** | Bawaan: hari ini. Ada tombol *Hari ini* / *Kemarin*. Tanggal yang belum tiba ditolak. |
| 2 | Pilih **sesi** pada kartu pilihan | Hanya sesi yang Anda ajar pada hari itu (sesuai jadwal). Bila hanya satu, langsung terpilih. |
| 3 | Isi skor **A1–C2 (0–10)** tiap peserta | JUMLAH tiap aspek terhitung seketika. Tersimpan otomatis sebagai **draf** ±1,5 detik setelah berhenti mengetik. **Enter** = butir berikutnya, **↑ ↓** = peserta atas/bawah. Di HP, tiap peserta tampil sebagai kartu. |
| 4 | Tekan **Selesai & Kirim ke Rekap** | Muncul konfirmasi jumlah terisi/kosong. Setelah dikirim, nilai **langsung masuk rekap** dan **terkunci**. |

- Nilai yang masih **draf tidak dihitung** di rekap. Dashboard Gadik mengingatkan sesi yang belum dikirim.
- Perlu koreksi setelah dikirim? Admin membuka **Rekap Harian → Penilaian Harian → Buka kunci** dan menuliskan alasannya. Gadik melihat alasan itu, memperbaiki nilai, lalu menekan **Selesai & Kirim ke Rekap** lagi.
- Setiap sesi yang dikirim menjadi satu **HARI** di Rekap Akhir (HARI 1 = tanggal terlama). Bila satu kelas punya dua sesi pada tanggal yang sama, keduanya tampil sebagai *HARI n-1* dan *HARI n-2*.
- Tombol **Unduh PDF / Unduh Excel** di atas lembar menghasilkan lembar format *HARI* seperti berkas asli (Excel lengkap dengan rumus JUMLAH).

### Rekap Akhir (Admin & Gadik)
1. Buka menu **Rekap Akhir** → muncul kartu tiap kelas (Gadik hanya melihat kelas penugasannya).
2. Klik kelas → tabel **NO · NAMA · PANGKAT/NRP · JUMLAH ASPEK PERILAKU · TEORI · PRAKTEK · NIL AKHIR · RANK**. Pilih urutan **Abjad** atau **Peringkat**; klik baris untuk rincian per hari.
3. **Unduh Excel** → berkas berisi sheet *HARI 1 … HARI n* dan *NIL AKHIR* dengan rumus aktif. **Unduh PDF** → tabel NIL AKHIR siap cetak (A4).

### Hak akses per peran (ditegakkan server)

| Menu | Admin Satdik | Gadik | Pengasuh |
|---|---|---|---|
| Dashboard | ringkasan semua kelas | kelasnya | peleton binaannya |
| Peserta Pelatihan | lihat semua kelas | tambah/ubah/hapus di kelasnya | lihat peletonnya |
| Personel & Akun, Master Data, Migrasi | ✔ | — | — |
| Jadwal | atur + deteksi bentrok | lihat kelasnya | lihat kelasnya |
| Input Nilai Harian (+ unduh lembar) | — | ✔ sesi yang ia ajar | — |
| Nilai Mental | — | — | ✔ peletonnya |
| Rekap Harian + Buka kunci sesi | ✔ semua kelas | — | — |
| Rekap Akhir (+ unduh PDF/Excel) | ✔ semua kelas | ✔ kelasnya | — |
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
| `Kelas` / `Angkatan_Kelas` | Angkatan / Gelombang, Kelas |
| `Peleton` | Kelas, Peleton |
| `Mapel` / `Mata_Pelajaran` | Mata Pelajaran, Bobot/JP |
| `Users` / `Akun` | Username, Nama, Peran |
| `Gadik` / `Pengasuh` | Username, Nama, Pangkat/NRP, HP |
| `Jadwal` | Kelas, Mapel, Gadik, Hari, Jam Mulai, Jam Selesai, Ruang |
| `Nilai` / `Nilai_Harian` | NRP, Mapel, **A1 A2 A3 B1 B2 C1 C2** (0–10) — atau satu kolom **Nilai** (0–100) — Tanggal (opsional), Waktu (opsional) |
| `Sesi_Nilai` (database SIPL 1.1/1.2) | semua kolom asli |
| `Nilai_Mental` | NRP, Nilai, Catatan |

Aturan pengaman:
- Spreadsheet sumber **hanya dibaca**, tidak pernah diubah.
- Aman diulang: data yang sudah ada tidak dibuat ganda (kunci: NRP untuk peserta, username untuk akun, peserta+mapel+tanggal untuk nilai).
- Nilai hasil import **langsung dihitung di rekap**. Bila kolom Tanggal kosong, dipakai tanggal dari kolom Waktu (atau tanggal import).
- Sumber yang hanya punya satu angka **Nilai** 0–100 diimpor sebagai butir A1–C2 = Nilai ÷ 10, sehingga nilai akhirnya tetap sama.
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

## Bagian G — Memperbarui Versi (1.0 / 1.1 → 1.2)

Lakukan saat aplikasi sepi (mis. sore hari). Data lama **tidak dihapus**. Langkahnya sama dari versi mana pun.

**1. Backend**
1. Buka proyek **SIPL Backend** di script.google.com.
2. Berkas **Kode** → hapus seluruh isinya → tempel isi `Kode.gs` versi 1.2. Lakukan hal yang sama untuk **Migrasi** (`Migrasi.gs`). Tekan **Ctrl + S**.
3. **Terapkan → Kelola deployment → ✏️ Edit → Versi: Versi baru → Terapkan.** (URL `/exec` tetap sama.)
4. Database diperbarui **otomatis** pada permintaan pertama (mis. saat ada yang login). Pembaruan ini:
   - membuat sheet baru **`Sesi_Nilai`** (status tiap sesi penilaian: Draf/Selesai),
   - menambah kolom **`Tanggal`**, **`ID_Jadwal`**, dan **`A1 A2 A3 B1 B2 C1 C2`** di sheet `Nilai`,
   - memberi tanggal pada nilai lama (diambil dari `Waktu_Input`),
   - mengubah nilai lama yang hanya satu angka (format 1.0/1.1) menjadi butir A1–C2 = nilai ÷ 10, sehingga nilai akhirnya tetap sama dan ikut dihitung di Rekap Akhir.

   Boleh juga dijalankan manual lebih dulu: pilih fungsi **`perbaikiSheet`** → ▶ **Jalankan** (aman diulang).

**2. Frontend**
1. Simpan dulu nilai `GAS_URL` dari `js/config.js` lama Anda.
2. Ekstrak `sipl-frontend.zip` versi 1.2, lalu **salin seluruh isinya menimpa** isi folder repository lama Anda (`index.html`, `css`, `js`, dan berkas `.md`).
3. Buka `js/config.js` yang baru → isi kembali `GAS_URL` yang tadi disimpan.
4. Kirim ke GitHub:
   ```bash
   git add .
   git commit -m "SIPL 1.2 - penilaian format PROLAT, rekap akhir, unduh PDF/Excel"
   git push
   ```
5. Tunggu 1–2 menit. Berkas versi baru otomatis dimuat (tidak perlu hapus cache); bila tampilan masih lama, tekan **Ctrl + Shift + R**.

**Catatan pembaruan**
- Kolom `Jenis_Pendidikan` di sheet `Angkatan_Kelas` tidak dipakai lagi. Boleh dibiarkan atau dihapus manual.
- Gadik yang sudah terjadwal di suatu kelas tetapi belum punya penugasan di kelas itu akan otomatis ditugaskan saat Admin menyimpan ulang jadwalnya. Periksa **Master Data → Penugasan** bila ada Gadik yang tidak melihat sesinya.

---

## Pemeliharaan (fungsi yang bisa dijalankan dari editor Apps Script)

| Fungsi | Kegunaan |
|---|---|
| `resetPasswordAdmin` | Lupa password Admin → password baru tampil di Log eksekusi |
| `bersihkanCache` | Setelah mengedit banyak data langsung di Google Sheets |
| `perbaikiSheet` | Membuat ulang sheet/kolom/format yang hilang (data tetap aman). Juga dipakai saat memperbarui dari v1.0 |
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
| Nilai | Gadik membuka Input Nilai Harian pada hari mengajar | hanya sesi miliknya yang tampil sebagai kartu pilihan |
| Nilai | ketik 12 pada butir A1 | ditandai "Harus 0–10", tidak dikirim |
| Nilai | isi A1–C2 satu peserta | JUMLAH tiap aspek langsung terhitung; status "Lengkap" |
| Nilai | isi skor lalu tunggu 2 detik | status bar "Draf tersimpan", baris muncul di sheet `Nilai` (kolom A1–C2) beserta tanggalnya |
| Nilai | buka Rekap sebelum Gadik menekan Selesai | nilai draf belum dihitung |
| Nilai | Gadik menekan **Selesai & Kirim ke Rekap** | nilai muncul di Rekap; kolom nilai Gadik terkunci |
| Nilai | Admin: Rekap Harian → **Buka kunci** | sesi kembali Draf; Gadik melihat alasannya dan bisa koreksi |
| Rekap Akhir | buka kelas → **Unduh Excel** | berkas berisi sheet HARI 1…n + NIL AKHIR; nilai di Excel sama dengan layar |
| Rekap Akhir | **Unduh PDF** | tabel NIL AKHIR + RANK siap cetak |
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
| `Sheet "Sesi_Nilai" tidak ditemukan di database` | database belum diperbarui | Jalankan **`perbaikiSheet`** sekali di editor Apps Script, atau pasang `Kode.gs` terbaru (memperbarui database otomatis) lalu **Versi baru** |
| Gadik: "Tidak ada sesi Anda pada hari …" | belum ada jadwal Gadik itu pada hari tersebut | Admin menambah sesi di **Jadwal Pelajaran**, lalu Gadik muat ulang halaman |
| Nilai sudah diisi tetapi tidak muncul di Rekap | sesi masih **Draf** | Gadik menekan **Selesai & Kirim ke Rekap** (lihat daftar sesi di Rekap Harian) |
| "Versi aplikasi di perangkat Anda sudah usang" | tampilan lama masih terbuka setelah pembaruan | tekan **Ctrl + Shift + R** (HP: tutup & buka lagi), lalu isi ulang baris itu |
| Tombol Unduh tidak menghasilkan berkas | koneksi terputus saat modul unduh pertama kali dimuat | periksa koneksi lalu tekan lagi |
| Gadik tidak bisa mengubah nilai | sesi sudah dikirim & terkunci | Admin: Rekap → Sesi Penilaian → **Buka kunci** |
| Jadwal tidak bisa dihapus / mapelnya tidak bisa diganti | sesi itu sudah punya nilai harian | ubah jam/hari/Gadik saja, atau buat sesi jadwal baru |

**Pengukur kecepatan:** di browser tekan F12 → Console → ketik `Perf.table()` untuk melihat waktu tiap panggilan (`server` = kerja Apps Script, `net` = jaringan + cold start).

---

## Catatan Penting

- **Arsitektur:** sesuai permintaan, aplikasi memakai pola REST API (frontend di GitHub Pages + Apps Script sebagai server JSON), bukan 4 berkas `google.script.run` seperti PRD 7.3. Fungsi dan aturan akses PRD tetap sama.
- **Penyesuaian skema kecil:** kolom `Pangkat` dan `NRP` dipisah (agar NRP bisa dicek duplikatnya), dan kolom `Status` ditambahkan pada `Peleton` dan `Mata_Pelajaran` (agar data yang sudah dipakai bisa dinonaktifkan sesuai US-06).
- **Riwayat perubahan** (login, nilai, kirim ke rekap, buka kunci, akun, jadwal) tetap ditulis ke sheet `Log_Aktivitas` setiap 1 menit untuk audit, tetapi tidak lagi ditampilkan sebagai menu. Setiap baris `Nilai` dan `Nilai_Mental` juga mencatat penginput dan waktunya; `Sesi_Nilai` mencatat siapa dan kapan sesi dikirim ke rekap.
- **Kuota:** dengan "Jalankan sebagai: Saya", seluruh pengguna memakai kuota akun pemilik (± 30 eksekusi bersamaan). Aplikasi dirancang hemat: cache berlapis, satu panggilan per layar, dan simpan nilai per kelompok.
- **Repository publik:** kode tampilan di GitHub terlihat publik, tetapi tidak berisi rahasia apa pun. Data hanya bisa dibaca lewat login di server.
- Aplikasi sudah diuji dengan tiruan layanan Google (274 skenario: login, isolasi kelas, lembar A1–C2, kunci & buka kunci, Rekap Akhir & RANK, berkas unduhan dibuka ulang dengan LibreOffice, bentrok jadwal, simpan otomatis, migrasi, pembaruan otomatis dari v1.0/1.1) dan diperiksa tampilannya di Chromium (desktop & HP). Tetap lakukan **Uji Coba Sebelum Rilis** di atas dengan akun Google asli.
