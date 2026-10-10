/**
 * ==========================================================================
 *  KONFIGURASI SIPL — satu-satunya berkas yang WAJIB Anda ubah.
 * ==========================================================================
 *  Ganti GAS_URL dengan URL Web App (/exec) dari Apps Script:
 *    Apps Script → Deploy → Manage deployments → salin "Web app URL".
 *  Contoh: https://script.google.com/macros/s/AKfycbx...panjang.../exec
 */
window.SIPL_CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbyrrE457EPVTuDp3VD6br386xMrMaPlZZ_5bJM_RbIrOMTw8EpCiWeVwasTrct1T7iC/exec',

  // Teks tampilan (opsional)
  APP_NAME: 'SIPL — SPN Polda Papua Barat',
  INSTANSI: 'SPN Polda Papua Barat',
  TAHUN_AJARAN: '2026',
  KOTA: 'Manokwari',          // tampil di kolom tanda tangan PDF/Excel: "Manokwari, 10 Oktober 2026"

  // Kop di pojok kiri atas PDF & Excel (satu teks per baris; baris terakhir diberi garis bawah)
  KOP: ['KEPOLISIAN NEGARA REPUBLIK INDONESIA', 'DAERAH PAPUA BARAT', 'SEKOLAH POLISI NEGARA'],

  // Logo bawaan (opsional). Taruh berkas logo di folder img/ lalu isi, contoh: 'img/logo.png'.
  // Logo yang diunggah Admin di menu Pengaturan selalu diutamakan. Kosongkan '' = ikon perisai.
  LOGO: '',

  // Sesi berakhir otomatis bila tidak ada aktivitas (menit). Server juga menegakkan 60 menit.
  IDLE_MINUTES: 60
};
