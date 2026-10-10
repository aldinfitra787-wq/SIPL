/* ==========================================================================
   SIPL — Inti klien
   Konfigurasi • penyimpanan lokal per pengguna • klien API tahan jaringan
   (timeout, retry, idempoten) • stale-while-revalidate • format WIT
   ========================================================================== */

const CFG = Object.assign({ GAS_URL: '', APP_NAME: 'SIPL — SPN Polda Papua Barat', IDLE_MINUTES: 60, TAHUN_AJARAN: '' }, window.SIPL_CONFIG || {});
const GAS_URL = String(CFG.GAS_URL || '').trim();
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
const READ_ACTIONS = /^(bootstrap|batch|publicInfo|nilaiList|mentalList|rekap|usersList|logs|importScan)$/;

function isConfigured() {
  return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{10,}\/exec$/.test(GAS_URL);
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
  const c = Store.get(uk(key), null);
  if (c) render(c.data, true);
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
  jam(j) { return String(j || '').replace(':', '.'); }
};
function menit(jam) { const m = String(jam || '').match(/^(\d{1,2})[:.](\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; }
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

/** Deteksi bentrok jadwal di klien (Gadik atau kelas sama, hari sama, jam tumpang tindih). */
function findConflicts(list) {
  const out = {};
  const byDay = {};
  (list || []).forEach(j => { (byDay[j.Hari] = byDay[j.Hari] || []).push(j); });
  Object.keys(byDay).forEach(h => {
    const arr = byDay[h];
    for (let i = 0; i < arr.length; i++) {
      for (let k = i + 1; k < arr.length; k++) {
        const a = arr[i], b = arr[k];
        const overlap = menit(a.Jam_Mulai) < menit(b.Jam_Selesai) && menit(b.Jam_Mulai) < menit(a.Jam_Selesai);
        if (!overlap) continue;
        const why = a.ID_Gadik === b.ID_Gadik ? 'GADIK' : (a.ID_Kelas === b.ID_Kelas ? 'KELAS' : '');
        if (!why) continue;
        (out[a.ID_Jadwal] = out[a.ID_Jadwal] || []).push({ id: b.ID_Jadwal, why });
        (out[b.ID_Jadwal] = out[b.ID_Jadwal] || []).push({ id: a.ID_Jadwal, why });
      }
    }
  });
  return out;
}
