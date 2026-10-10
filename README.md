# SIPL — SPN Polda Papua Barat (Frontend) • v1.3.0

Tampilan web **Sistem Informasi Pelatihan** untuk Admin Satdik, Gadik, dan Pengasuh.
Berkas statis (HTML/CSS/JS murni, tanpa framework) yang di-hosting di GitHub Pages dan terhubung ke backend Google Apps Script.

## Satu-satunya yang wajib diubah
`js/config.js` → isi `GAS_URL` dengan URL Web App `/exec` dari Apps Script.

## Struktur
```
index.html            Kerangka aplikasi + halaman login
css/style.css         Tema burgundy–emas–putih, responsif (HP → kartu)
js/config.js          Alamat server (GAS_URL), teks tampilan & logo bawaan (LOGO)
js/icons.js           Ikon SVG ringan (tanpa pustaka luar)
js/core.js            Klien API, cache per pengguna, SWR, format WIT, rumus penilaian PROLAT
js/ui.js              Toast, modal, tabel cari/urut/halaman
js/pages.js           Router SPA + Dashboard, Peserta, Jadwal, Input Nilai Harian, Rekap Akhir, Nilai Mental, Pengaturan
js/admin.js           Khusus Admin (dimuat setelah login Admin): Personel, Master Data, Jadwal, Rekap Harian, Migrasi
js/export.js          Unduh Excel (.xlsx dengan rumus) & PDF — dimuat saat tombol Unduh pertama kali ditekan
img/                  Tempat logo bawaan opsional (lihat img/CARA-GANTI-LOGO.txt)
PANDUAN-INSTALASI.md  Langkah lengkap backend + GitHub Pages + migrasi + pembaruan versi
```

## Format penilaian (PROLAT)
Lembar harian: A1 A2 A3 (Perilaku) · B1 B2 (Teori) · C1 C2 (Praktek), skor 0–10, JUMLAH per aspek.
NIL AKHIR = Perilaku 30% + Teori 20% + Praktek 50% (nilai aspek = Σ JUMLAH ÷ hari ÷ butir × 10), lalu RANK.
Format ada di satu tempat: `PENILAIAN` di `js/core.js` dan di `Kode.gs` (harus sama).

## Hapus & logo
Semua tombol Hapus memakai satu dialog (`hapusData` di `js/pages.js`): server menampilkan dulu data yang ikut terhapus, lalu menghapus semuanya setelah dikonfirmasi.
Logo diganti Admin di **Pengaturan** dan disimpan di database. Panduan: PANDUAN-INSTALASI.md Bagian I.

## Memperbarui
Saat merilis versi baru, naikkan `FE_VERSION` di `js/core.js` dan `?v=` di `index.html` agar browser memuat berkas baru.
```bash
git add .
git commit -m "Pembaruan"
git push
```

Panduan lengkap: **PANDUAN-INSTALASI.md**.
