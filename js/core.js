/* ==========================================================================
   SIPL — Inti klien
   Konfigurasi • penyimpanan lokal per pengguna • klien API tahan jaringan
   (timeout, retry, idempoten) • stale-while-revalidate • format WIT
   ========================================================================== */

const CFG = Object.assign({ GAS_URL: '', APP_NAME: 'SIPL — SPN Polda Papua Barat', IDLE_MINUTES: 60, TAHUN_AJARAN: '' }, window.SIPL_CONFIG || {});
const GAS_URL = String(CFG.GAS_URL || '').trim();
const FE_VERSION = '1.6.0';              // naikkan bersama ?v= di index.html saat rilis
const LS = 'sipl:v1:';
const TZ = 'Asia/Jayapura';
const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** State aplikasi (satu sumber kebenaran di klien). */
const S = { token: '', uid: '', role: '', me: null, boot: null, data: {}, current: null, refVer: 0 };

// --------------------------------------------------------------------------
// Penyimpanan lokal (namespace per pengguna, aman bila kuota penuh)
// --------------------------------------------------------------------------
const Store = {
  get(k, d) { try { const v = localStorage.getItem(LS + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) {
    const s = JSON.stringify(v);
    try { localStorage.setItem(LS + k, s); }
    catch (e) {
      try {
        Object.keys(localStorage).filter(x => x.indexOf(LS + 'u:') === 0 && x.indexOf(LS + uk('')) !== 0).forEach(x => localStorage.removeItem(x));
        localStorage.setItem(LS + k, s);
      } catch (e2) { /* tetap jalan tanpa cache */ }
    }
  },
  del(k) { try { localStorage.removeItem(LS + k); } catch (e) { /* abaikan */ } },
  dropUser(uid) {
    try { Object.keys(localStorage).filter(x => x.indexOf(LS + 'u:' + uid + ':') === 0).forEach(x => localStorage.removeItem(x)); } catch (e) { /* abaikan */ }
  }
};
function uk(k) { return 'u:' + (S.uid || 'anon') + ':' + k; }
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h + ':' + s.length; }

// --------------------------------------------------------------------------
// Pengukur performa — panggil Perf.table() di Console browser
// --------------------------------------------------------------------------
const Perf = {
  rows: [],
  add(action, total, server) {
    this.rows.push({ action, total, server: server == null ? null : server, net: server == null ? null : total - server, at: new Date().toLocaleTimeString() });
    if (this.rows.length > 200) this.rows.shift();
  },
  table() { console.table(this.rows.slice(-40)); }
};
window.Perf = Perf;

// --------------------------------------------------------------------------
// Event bus kecil
// --------------------------------------------------------------------------
const Bus = {
  h: {},
  on(ev, fn) { (this.h[ev] = this.h[ev] || []).push(fn); },
  emit(ev, data) { (this.h[ev] || []).slice().forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); }
};

// --------------------------------------------------------------------------
// Klien API (fetch → GAS /exec, text/plain agar tanpa CORS preflight)
// --------------------------------------------------------------------------
const READ_ACTIONS = /^(bootstrap|batch|publicInfo|nilaiHarian|mentalList|rekap|usersList|importScan|dokumenUnduh|foto)$/;

function isConfigured() {
  return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{10,}\/exec$/.test(GAS_URL) && GAS_URL.indexOf('GANTI_DENGAN') === -1;
}

function rid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

async function apiOnce(action, data, timeout, reqId) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  const t0 = performance.now();
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST', redirect: 'follow', cache: 'no-store', signal: ctrl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: S.token || '', reqId, data: data || {} })
    });
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      Perf.add(action, Math.round(performance.now() - t0), j.ms);
      return j;
    } catch (e) {
      return { success: false, network: true, retryable: res.status >= 500 || res.status === 429 || res.status === 200, message: 'Server membalas tidak sesuai (HTTP ' + res.status + '). Coba lagi sebentar.' };
    }
  } catch (err) {
    return { success: false, network: true, retryable: true, message: err && err.name === 'AbortError' ? 'Server terlalu lama merespons.' : 'Koneksi ke server terputus.' };
  } finally {
    clearTimeout(timer);
  }
}

function waitOnline(ms) {
  return new Promise(resolve => {
    if (navigator.onLine !== false) return resolve();
    const done = () => { clearTimeout(t); window.removeEventListener('online', done); resolve(); };
    const t = setTimeout(done, ms);
    window.addEventListener('online', done);
  });
}

/**
 * api('aksi', data) → { success, data, message, code }
 * Baca: 3 percobaan. Tulis: 2 percobaan dengan reqId yang sama (aman, server idempoten).
 */
async function api(action, data, opt) {
  opt = opt || {};
  if (!isConfigured()) return { success: false, code: 'CONFIG', message: 'Alamat server (GAS_URL) belum diisi di js/config.js.' };
  const isRead = READ_ACTIONS.test(action);
  const reqId = isRead ? '' : (opt.reqId || rid());
  const tries = opt.tries || (isRead ? 3 : 3);
  let res;
  for (let i = 0; i < tries; i++) {
    if (i) {
      await new Promise(r => setTimeout(r, 1200 * i));
      if (navigator.onLine === false) await waitOnline(20000);
    }
    res = await apiOnce(action, data, opt.timeout || (isRead ? (i ? 40000 : 25000) : 90000), reqId);
    if (res.success || !res.retryable) break;
  }
  if (!res.success && res.code === 'AUTH' && action !== 'login') Bus.emit('auth:expired', res.message);
  return res;
}

/** Bangunkan server (cold start) tanpa menunggu. */
function warmUp() {
  if (!isConfigured()) return;
  fetch(GAS_URL + '?action=ping&t=' + Date.now(), { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
}

/** Info publik (nama app & logo) — juga membangunkan server. */
async function fetchPublicInfo() {
  if (!isConfigured()) return null;
  try {
    const r = await fetch(GAS_URL + '?action=publicInfo&t=' + Date.now(), { cache: 'no-store' });
    const j = await r.json();
    return j && j.success ? j.data : null;
  } catch (e) { return null; }
}

/**
 * Stale-while-revalidate: render dari cache seketika, segarkan di latar.
 * render(data, fromCache) dipanggil maksimal 2× dan hanya bila data berubah.
 */
async function swr(key, action, payload, render, opt) {
  opt = opt || {};
  const fresh = opt.fresh == null ? 60000 : opt.fresh;
  let c = Store.get(uk(key), null);
  if (c && (!c.data || typeof c.data !== 'object' || (opt.valid && !opt.valid(c.data)))) { Store.del(uk(key)); c = null; }   // cache format lama
  if (c) {
    try { render(c.data, true); }
    catch (e) { console.warn('Cache ' + key + ' diabaikan:', e); Store.del(uk(key)); c = null; }   // jangan sampai cache rusak menghentikan pemuatan
  }
  if (c && !opt.force && Date.now() - c.t < fresh) return { success: true, data: c.data, cached: true };
  const res = await api(action, payload);
  if (res.success) {
    const h = hashStr(JSON.stringify(res.data));
    Store.set(uk(key), { t: Date.now(), h, data: res.data });
    if (!c || c.h !== h) render(res.data, false);
  } else if (!c && opt.onError) {
    opt.onError(res);
  }
  return res;
}
/** Buang cache lokal pengguna yang kuncinya diawali salah satu prefiks (mis. setelah data dihapus). */
function cacheDrop(prefixes) {
  try {
    const base = LS + uk('');
    Object.keys(localStorage).filter(x => x.indexOf(base) === 0 && prefixes.some(p => x.indexOf(base + p) === 0)).forEach(x => localStorage.removeItem(x));
  } catch (e) { /* abaikan */ }
}
function cachePut(key, data) { Store.set(uk(key), { t: Date.now(), h: hashStr(JSON.stringify(data)), data }); }
function cacheGet(key) { const c = Store.get(uk(key), null); return c ? c.data : null; }

// --------------------------------------------------------------------------
// Format & waktu WIT
// --------------------------------------------------------------------------
let _witFmt = null;
function witParts(d) {
  if (!_witFmt) {
    _witFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false });
  }
  const o = {};
  _witFmt.formatToParts(d).forEach(p => { o[p.type] = p.value; });
  const wd = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[o.weekday];
  return { y: +o.year, m: +o.month, d: +o.day, hh: +o.hour % 24, mi: +o.minute, wd };
}
function nowWIT() {
  const p = witParts(new Date());
  return { hari: HARI[p.wd], min: p.hh * 60 + p.mi, y: p.y, m: p.m, d: p.d };
}
function toDate(v) { if (!v) return null; const d = v instanceof Date ? v : new Date(v); return isNaN(d.getTime()) ? null : d; }
const pad2 = n => (n < 10 ? '0' : '') + n;
const fmt = {
  date(v) { const d = toDate(v); if (!d) return '—'; const p = witParts(d); return p.d + ' ' + BULAN[p.m - 1] + ' ' + p.y; },
  dateTime(v) { const d = toDate(v); if (!d) return '—'; const p = witParts(d); return p.d + ' ' + BULAN[p.m - 1] + ' ' + p.y + ', ' + pad2(p.hh) + '.' + pad2(p.mi); },
  time(v) { const d = toDate(v); if (!d) return '—'; const p = witParts(d); return pad2(p.hh) + '.' + pad2(p.mi); },
  ago(v) {
    const d = toDate(v); if (!d) return '—';
    const s = (Date.now() - d.getTime()) / 1000;
    if (s < 50) return 'baru saja';
    if (s < 3600) return Math.round(s / 60) + ' mnt lalu';
    const a = witParts(d), b = witParts(new Date());
    if (a.y === b.y && a.m === b.m && a.d === b.d) return 'hari ini ' + pad2(a.hh) + '.' + pad2(a.mi);
    if (s < 172800 && (b.d - a.d === 1 || b.d === 1)) return 'kemarin ' + pad2(a.hh) + '.' + pad2(a.mi);
    return fmt.dateTime(d);
  },
  num(v, dec) {
    if (v === '' || v == null || isNaN(Number(v))) return '—';
    return Number(v).toLocaleString('id-ID', { minimumFractionDigits: dec == null ? 0 : dec, maximumFractionDigits: dec == null ? 2 : dec });
  },
  jam(j) { return String(j || '').replace(':', '.'); },
  /** "2026-10-12" → "12 Okt 2026" · {hari:true} → "Senin, 12 Okt 2026" · {short:true} → "12 Okt" */
  tgl(t, o) {
    const p = tglParts(t);
    if (!p) return t || '—';
    o = o || {};
    return (o.hari ? hariOf(t) + ', ' : '') + p[2] + ' ' + BULAN[p[1] - 1] + (o.short ? '' : ' ' + p[0]);
  }
};
function menit(jam) { const m = String(jam || '').match(/^(\d{1,2})[:.](\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; }
// Tanggal kalender "yyyy-mm-dd" (zona WIT) untuk penilaian harian
function todayStr() { const n = nowWIT(); return n.y + '-' + pad2(n.m) + '-' + pad2(n.d); }
function tglParts(t) { const m = String(t || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? [+m[1], +m[2], +m[3]] : null; }
function isTgl(t) { const p = tglParts(t); if (!p) return false; const d = new Date(Date.UTC(p[0], p[1] - 1, p[2])); return d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2]; }
function addDays(t, n) { const p = tglParts(t), d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)); return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); }
function hariOf(t) { const p = tglParts(t); return p ? HARI[(new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay() + 6) % 7] : ''; }
/** Tanggal terakhir (≤ dari) yang jatuh pada hari tertentu. */
function lastDateOf(hari, from) { let t = from || todayStr(); for (let i = 0; i < 7; i++) { if (hariOf(t) === hari) return t; t = addDays(t, -1); } return t; }
function avg(arr) { const a = arr.filter(v => v !== '' && v != null && !isNaN(Number(v))).map(Number); return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null; }

// --------------------------------------------------------------------------
// Utilitas umum
// --------------------------------------------------------------------------
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function debounce(fn, ms) { let t; return function () { const a = arguments, self = this; clearTimeout(t); t = setTimeout(() => fn.apply(self, a), ms); }; }
function initials(name) {
  const clean = String(name || '').split(',')[0].replace(/\b(Dr|Drs|Ir|Hj|H)\.\s*/g, '');
  const words = clean.split(/\s+/).filter(w => w && !/^[A-Z.]{2,}$/.test(w) && !/^(Tk\.?|I|II|III)$/.test(w) && !/\.$/.test(w));
  const pick = words.length ? words : clean.split(/\s+/).filter(Boolean);
  return ((pick[0] || '?').charAt(0) + (pick[1] ? pick[1].charAt(0) : '')).toUpperCase();
}
function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
const collator = new Intl.Collator('id', { numeric: true, sensitivity: 'base' });

// --------------------------------------------------------------------------
// Format penilaian PROLAT (sama dengan server & berkas PENILAIAN_PROLAT_2026.xlsx)
// Butir 0–10 → JUMLAH per aspek → nilai aspek = Σ JUMLAH ÷ hari ÷ butir × 10
// → NILAI AKHIR = Perilaku 30% + Teori 20% + Praktek 50% → RANK.
// --------------------------------------------------------------------------
const PENILAIAN = {
  SKOR_MAX: 10,
  ASPEK: [
    { kode: 'A', nama: 'Aspek Perilaku', butir: ['A1', 'A2', 'A3'], bobot: 0.3 },
    { kode: 'B', nama: 'Aspek Teori', butir: ['B1', 'B2'], bobot: 0.2 },
    { kode: 'C', nama: 'Aspek Praktek', butir: ['C1', 'C2'], bobot: 0.5 }
  ]
};
const BUTIR = PENILAIAN.ASPEK.reduce((a, g) => a.concat(g.butir), []);
const KOSONG = () => BUTIR.map(() => '');

/** Skor satu butir 0–10 (koma/titik desimal, maks. 2 angka di belakang koma). */
function parseSkor(v) {
  const s = String(v == null ? '' : v).trim();
  if (s === '') return { empty: true };
  const n = Number(s.replace(',', '.'));
  if (!isFinite(n) || n < 0 || n > PENILAIAN.SKOR_MAX || !/^\d{1,2}([.,]\d{1,2})?$/.test(s)) return { error: true };
  return { value: Math.round(n * 100) / 100 };
}
/** JUMLAH per aspek (butir kosong = 0) → [ΣPerilaku, ΣTeori, ΣPraktek]. */
function jumlahAspek(v) {
  let i = 0;
  return PENILAIAN.ASPEK.map(g => {
    let s = 0;
    g.butir.forEach(() => { const x = v ? v[i] : ''; i++; if (x !== '' && x != null && isFinite(Number(x))) s += Number(x); });
    return Math.round(s * 100) / 100;
  });
}
/** Nilai harian skala 100 (dipakai untuk ringkasan; rata-ratanya = NILAI AKHIR). */
function nilaiHarian(v) {
  const j = jumlahAspek(v);
  return Math.round(PENILAIAN.ASPEK.reduce((s, g, gi) => s + j[gi] / g.butir.length * 10 * g.bobot, 0) * 100) / 100;
}
function terisi(v) { return (v || []).filter(x => x !== '' && x != null).length; }
function fmtSkor(x) { return x === '' || x == null ? '' : String(x).replace('.', ','); }
function urutNama(list) { return list.slice().sort((a, b) => collator.compare(a.Nama_Lengkap, b.Nama_Lengkap) || collator.compare(String(a.NRP), String(b.NRP))); }
function pangkatNrp(p) { return (p.Pangkat ? p.Pangkat + ' / ' : '') + (p.NRP || ''); }

/** Sesi yang sudah dikirim → urutan "HARI 1, HARI 2, …" (dua sesi di tanggal sama: "HARI 2-1", "HARI 2-2"). */
function hariPenilaian(sesi) {
  const byDate = {};
  (sesi || []).filter(s => s.Status === 'Selesai').forEach(s => { (byDate[s.Tanggal] = byDate[s.Tanggal] || []).push(s); });
  const out = [];
  Object.keys(byDate).sort().forEach((t, di) => {
    const list = byDate[t].sort((a, b) => (a.Jam || '').localeCompare(b.Jam || '') || String(a.ID_Jadwal).localeCompare(String(b.ID_Jadwal)));
    list.forEach((s, k) => out.push({ s, label: 'HARI ' + (di + 1) + (list.length > 1 ? '-' + (k + 1) : '') }));
  });
  return out;
}

/** Label HARI dihitung per mata pelajaran (1 mapel = 6 hari): { ID_Sesi: 'HARI n' }. */
function labelHariMapel(sesi) {
  const by = {}, out = {};
  (sesi || []).forEach(x => { (by[x.ID_Mapel] = by[x.ID_Mapel] || []).push(x); });
  Object.keys(by).forEach(m => hariPenilaian(by[m]).forEach(u => { out[u.s.ID_Sesi] = u.label; }));
  return out;
}

/**
 * NIL AKHIR per peserta sesuai rumus berkas Excel:
 *   aspek = Σ JUMLAH aspek seluruh hari ÷ n hari ÷ banyak butir × 10
 *   NA = Σ aspek × bobot;  RANK = RANK(NA) + COUNTIF(baris di atas dengan NA sama) − 1 (urut abjad).
 */
function rekapAkhir(d, pesertaList) {
  const units = hariPenilaian(d.sesi), n = units.length, A = PENILAIAN.ASPEK;
  const rows = urutNama(pesertaList).map((p, i) => {
    const per = units.map(u => { const v = ((d.nilai || {})[u.s.ID_Sesi] || {})[p.ID_Peserta] || KOSONG(); return { u, v, j: jumlahAspek(v), nh: nilaiHarian(v) }; });
    const asp = A.map((g, gi) => (n ? per.reduce((s, x) => s + x.j[gi], 0) / n / g.butir.length * 10 : null));
    const na = n ? asp.reduce((s, x, gi) => s + x * A[gi].bobot, 0) : null;
    return { ID_Peserta: p.ID_Peserta, p, no: i + 1, Nama: p.Nama_Lengkap, per, asp, na };
  });
  rows.forEach((r, i) => {
    if (r.na == null) { r.rank = null; return; }
    const k = Math.round(r.na * 1e6);
    r.rank = 1 + rows.filter((o, j) => { const ok = Math.round(o.na * 1e6); return ok > k || (ok === k && j < i); }).length;
  });
  return { units, n, rows };
}

/** Data kolom tanda tangan Gadik pengampu (PDF/Excel). */
function ttdGadik(idGadik, tanggal) {
  const g = idGadik ? R().gadik[idGadik] : null, me = S.me || {};
  const self = S.role === 'Gadik' && me.ID_Gadik && me.ID_Gadik === idGadik;
  return {
    kota: CFG.KOTA === undefined ? 'Manokwari' : CFG.KOTA, tanggal: tglPanjang(tanggal || todayStr()), jabatan: 'GADIK PENGAMPU MATA PELAJARAN',
    nama: self ? me.Nama_Lengkap : g ? g.Nama_Lengkap : '', nrp: self ? me.NRP : g ? g.NRP || '' : '', pangkat: self ? me.Pangkat : g ? g.Pangkat || '' : ''
  };
}

/** Tanggal panjang Indonesia: "Senin, 5 Oktober 2026". */
const BULAN_P = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
function tglPanjang(t, withHari) { const p = tglParts(t); return p ? (withHari ? hariOf(t) + ', ' : '') + p[2] + ' ' + BULAN_P[p[1] - 1] + ' ' + p[0] : (t || ''); }

// --------------------------------------------------------------------------
// Unduh PDF / Excel (modul export.js dimuat saat pertama kali dibutuhkan)
// --------------------------------------------------------------------------
let _eksporP = null;
function muatEkspor() {
  if (window.Ekspor) return Promise.resolve();
  if (!_eksporP) _eksporP = loadScript('js/export.js').catch(e => { _eksporP = null; throw e; });
  return _eksporP;
}
function namaBerkas(parts, ext) {
  return parts.filter(Boolean).join('_').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 120) + '.' + ext;
}
async function unduhBerkas(jenis, data, nama, btn) {
  const done = busy(btn, 'Menyiapkan…');
  try {
    await muatEkspor();
    const blob = window.Ekspor[jenis](data);
    window.Ekspor.simpan(blob, nama);
    toast('Berkas siap', nama, 'success');
  } catch (e) {
    console.error(e);
    toast('Berkas gagal dibuat', 'Periksa koneksi internet lalu coba lagi.', 'error');
  } finally { done(); }
}
function tombolUnduh() {
  return '<div class="unduh"><button type="button" class="btn outline sm" data-unduh="pdf">' + icon('download', 'sm') + 'Unduh PDF</button>' +
    '<button type="button" class="btn outline sm" data-unduh="xlsx">' + icon('file-sheet', 'sm') + 'Unduh Excel</button></div>';
}

/** Validasi nilai 0–100 di klien (sama dengan server). */
function parseGrade(v) {
  const s = String(v == null ? '' : v).trim();
  if (s === '') return { empty: true };
  const n = Number(s.replace(',', '.'));
  if (!isFinite(n) || n < 0 || n > 100 || !/^\d{1,3}([.,]\d{1,2})?$/.test(s)) return { error: true };
  return { value: Math.round(n * 100) / 100 };
}

// --------------------------------------------------------------------------
// Data referensi dari bootstrap (memo, otomatis segar saat boot berubah)
// --------------------------------------------------------------------------
let _ref = null, _refVer = -1;
function R() {
  if (_ref && _refVer === S.refVer) return _ref;
  const b = S.boot || { ref: { kelas: [], peleton: [], mapel: [], gadik: [] }, peserta: [], jadwal: [] };
  const by = (arr, k) => { const m = {}; (arr || []).forEach(o => { m[o[k]] = o; }); return m; };
  _ref = {
    kelas: by(b.ref.kelas, 'ID_Kelas'), pel: by(b.ref.peleton, 'ID_Peleton'), mapel: by(b.ref.mapel, 'ID_Mapel'),
    gadik: by(b.ref.gadik, 'ID_Gadik'), peserta: by(b.peserta, 'ID_Peserta')
  };
  _refVer = S.refVer;
  return _ref;
}
/** Panggil setelah S.boot berubah: simpan ke cache & segarkan memo. */
function bootChanged(persist) {
  S.refVer++;
  if (persist !== false && S.boot) cachePut('boot', S.boot);
  Bus.emit('boot');
}
function kelasName(id, withAngkatan) {
  const k = R().kelas[id];
  if (!k) return id || '—';
  return withAngkatan ? k.Nama_Kelas + ' · ' + k.Nama_Angkatan : k.Nama_Kelas;
}
function pelName(id) { const p = R().pel[id]; return p ? p.Nama_Peleton : (id ? id : '—'); }
function mapelName(id) { const m = R().mapel[id]; return m ? m.Nama_Mapel : (id || '—'); }
function gadikName(id) { const g = R().gadik[id]; return g ? g.Nama_Lengkap : (id || '—'); }
function isAktif(v) { return ['', 'aktif', 'true', 'ya', '1', 'active'].indexOf(String(v == null ? '' : v).toLowerCase()) > -1; }
function sortKelas(list) { return list.slice().sort((a, b) => collator.compare(a.Nama_Angkatan + ' ' + a.Nama_Kelas, b.Nama_Angkatan + ' ' + b.Nama_Kelas)); }
function kelasList() { return sortKelas(S.boot ? S.boot.ref.kelas : []); }
function pelOf(idKelas) { return (S.boot ? S.boot.ref.peleton : []).filter(p => !idKelas || p.ID_Kelas === idKelas).sort((a, b) => collator.compare(a.Nama_Peleton, b.Nama_Peleton)); }
function mapelList(activeOnly) { return (S.boot ? S.boot.ref.mapel : []).filter(m => !activeOnly || isAktif(m.Status)).sort((a, b) => collator.compare(a.Nama_Mapel, b.Nama_Mapel)); }

// --------------------------------------------------------------------------
// Jadwal pelatihan: satu mapel = blok 6 hari (Senin–Sabtu), pukul 08.00–17.00 WIT
// --------------------------------------------------------------------------
const JADWAL = { HARI_BLOK: 6, HARI_DEFAULT: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'], JAM_MULAI: '08:00', JAM_SELESAI: '17:00' };
function hariList(j) { const v = typeof j === 'string' ? j : (j && j.Hari) || ''; return String(v).split(',').map(x => x.trim()).filter(x => HARI.indexOf(x) > -1).sort((a, b) => HARI.indexOf(a) - HARI.indexOf(b)); }
/** "Senin–Sabtu" bila berurutan, selain itu "Senin, Rabu". */
function hariTeks(j) {
  const l = hariList(j), ix = l.map(h => HARI.indexOf(h));
  if (l.length > 2 && ix.every((x, k) => !k || x === ix[k - 1] + 1)) return l[0] + '–' + l[l.length - 1];
  return l.join(', ');
}
/** Dilaksanakan pada tanggal ini? (hari pelaksanaan + rentang tanggal; jadwal lama tanpa tanggal = tiap pekan). */
function jadwalAktif(j, tgl) {
  if (hariList(j).indexOf(hariOf(tgl)) === -1) return false;
  return !(j.Tanggal_Mulai && tgl < j.Tanggal_Mulai) && !(j.Tanggal_Selesai && tgl > j.Tanggal_Selesai);
}
/** Penutupan dimajukan ke Jumat → lembar hari Sabtu boleh diisi sejak Jumat. */
function bolehIsiAwal(j, tgl) { return j.Tutup_Jumat === 'Ya' && hariOf(tgl) === 'Sabtu' && tgl === addDays(todayStr(), 1) && jadwalAktif(j, tgl); }
function tglRingkas(t) { const p = tglParts(t); return p ? p[2] + ' ' + BULAN_P[p[1] - 1].slice(0, 3) + ' ' + p[0] : ''; }
/** "12–17 Okt 2026 • Senin–Sabtu" atau "Setiap Senin" (jadwal lama). */
function rentangJadwal(j) {
  if (!j.Tanggal_Mulai) return 'Setiap ' + hariTeks(j);
  const a = tglParts(j.Tanggal_Mulai), b = tglParts(j.Tanggal_Selesai || j.Tanggal_Mulai);
  const tg = a[0] === b[0] && a[1] === b[1] ? a[2] + '–' + b[2] + ' ' + BULAN_P[a[1] - 1].slice(0, 3) + ' ' + a[0] : tglRingkas(j.Tanggal_Mulai) + ' – ' + tglRingkas(j.Tanggal_Selesai);
  return tg + ' • ' + hariTeks(j);
}
/** Tanggal-tanggal pelaksanaan (untuk blok bertanggal). */
function tanggalJadwal(j) {
  const out = [];
  if (!j.Tanggal_Mulai) return out;
  for (let t = j.Tanggal_Mulai, n = 0; t <= (j.Tanggal_Selesai || j.Tanggal_Mulai) && n < 400; t = addDays(t, 1), n++) if (hariList(j).indexOf(hariOf(t)) > -1) out.push(t);
  return out;
}
function jadwalTumpang(a, b) {
  const hb = hariList(b);
  if (!hariList(a).some(h => hb.indexOf(h) > -1)) return false;
  const a1 = a.Tanggal_Mulai || '0000', a2 = a.Tanggal_Selesai || '9999', b1 = b.Tanggal_Mulai || '0000', b2 = b.Tanggal_Selesai || '9999';
  if (a2 < b1 || b2 < a1) return false;
  return menit(a.Jam_Mulai) < menit(b.Jam_Selesai) && menit(b.Jam_Mulai) < menit(a.Jam_Selesai);
}

/** Deteksi bentrok jadwal di klien (Gadik atau kelas sama, hari & tanggal beririsan, jam tumpang tindih). */
function findConflicts(list) {
  const out = {}, arr = list || [];
  for (let i = 0; i < arr.length; i++) {
    for (let k = i + 1; k < arr.length; k++) {
      const a = arr[i], b = arr[k];
      const why = a.ID_Gadik === b.ID_Gadik ? 'GADIK' : (a.ID_Kelas === b.ID_Kelas ? 'KELAS' : '');
      if (!why || !jadwalTumpang(a, b)) continue;
      (out[a.ID_Jadwal] = out[a.ID_Jadwal] || []).push({ id: b.ID_Jadwal, why });
      (out[b.ID_Jadwal] = out[b.ID_Jadwal] || []).push({ id: a.ID_Jadwal, why });
    }
  }
  return out;
}
