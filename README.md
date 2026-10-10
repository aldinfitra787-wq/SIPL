# SIPL — SPN Polda Papua Barat (Frontend)

Tampilan web **Sistem Informasi Pendidikan dan Latihan** untuk Admin Satdik, Gadik, dan Pengasuh.
Berkas statis (HTML/CSS/JS murni, tanpa framework) yang di-hosting di GitHub Pages dan terhubung ke backend Google Apps Script.

## Satu-satunya yang wajib diubah
`js/config.js` → isi `GAS_URL` dengan URL Web App `/exec` dari Apps Script.

## Struktur
```
index.html            Kerangka aplikasi + halaman login
css/style.css         Tema burgundy–emas–putih, responsif (HP → kartu)
js/config.js          Alamat server (GAS_URL) & teks tampilan
js/icons.js           Ikon SVG ringan (tanpa pustaka luar)
js/core.js            Klien API (timeout, retry, idempoten), cache per pengguna, SWR, format WIT
js/ui.js              Toast, modal, tabel cari/urut/halaman
js/pages.js           Router SPA + Dashboard, Peserta, Jadwal, Input Nilai, Nilai Mental, Pengaturan
js/admin.js           Khusus Admin (dimuat setelah login Admin): Personel, Master Data, Jadwal, Rekap, Log, Migrasi
PANDUAN-INSTALASI.md  Langkah lengkap backend + GitHub Pages + migrasi
```

## Memperbarui
```bash
git add .
git commit -m "Pembaruan"
git push
```

Panduan lengkap: **PANDUAN-INSTALASI.md**.
