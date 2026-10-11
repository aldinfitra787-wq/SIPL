/* ==========================================================================
   SIPL — Router SPA + halaman bersama (semua peran)
   Halaman dibuat sekali lalu disembunyikan/ditampilkan (tidak dibuang).
   ========================================================================== */

const Pages = {};
function page(name, def) { Pages[name] = def; }
function go(path) { const h = '#/' + path; if (location.hash === h) route(); else location.hash = h; }
function titleOf(def, param) { return typeof def.title === 'function' ? def.title(param) : def.title; }

function route() {
  if (!S.token || !S.me) return;
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  let name = parts[0] || 'dashboard';
  const param = parts.slice(1).map(decodeURIComponent).join('/');
  let def = Pages[name];
  if (!def || (def.roles && def.roles.indexOf(S.role) === -1)) {
    name = 'dashboard'; def = Pages.dashboard;
    if (location.hash !== '#/dashboard') history.replaceState(null, '', '#/dashboard');
  }
  const view = $('#view');
  let el = view.querySelector('.page[data-page="' + name + '"]');
  const isNew = !el;
  if (!el) { el = document.createElement('section'); el.className = 'page'; el.dataset.page = name; view.appendChild(el); }
  const prev = S.current;
  if (prev && prev.name !== name && prev.def.leave) prev.def.leave(prev.el);
  $$('.page', view).forEach(p => { p.hidden = p !== el; });
  S.current = { name, param, el, def };
  const t = titleOf(def, param);
  document.title = t + ' — SIPL';
  $('#crumb-title').textContent = t;
  Bus.emit('route', name);
  const pindah = !prev || prev.name !== name || prev.param !== param;
  if (pindah) masukHalaman(el);
  def.show(el, param, { isNew });
  if (pindah) { window.scrollTo(0, 0); raf(() => hitungNaik(el)); }
}

// ---------- Animasi halus: masuk halaman & angka menghitung naik ----------
const GERAK = !!window.requestAnimationFrame && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
function raf(f) { return (window.requestAnimationFrame || (g => setTimeout(() => g(Date.now()), 16)))(f); }
function masukHalaman(el) {
  if (!GERAK) return;
  el.classList.remove('pg-in'); void el.offsetWidth; el.classList.add('pg-in');
  clearTimeout(el._pgT); el._pgT = setTimeout(() => el.classList.remove('pg-in'), 1300);
}
/** Angka pada kartu statistik dihitung naik dari 0 (± 0,7 detik). */
function hitungNaik(root) {
  if (!GERAK) return;
  $$('.stat .big', root).forEach(b => {
    const tn = Array.from(b.childNodes).find(n => n.nodeType === 3 && /\d/.test(n.nodeValue));
    if (!tn || b._counting) return;
    const raw = tn.nodeValue.trim(), m = raw.match(/^(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d+))?$/);
    if (!m) return;
    const dec = m[2] ? m[2].length : 0, target = Number(m[1].replace(/\./g, '') + (dec ? '.' + m[2] : ''));
    if (!isFinite(target) || target === 0) return;
    const pre = tn.nodeValue.match(/^\s*/)[0], post = tn.nodeValue.match(/\s*$/)[0], t0 = performance.now(), dur = 700;
    b._counting = true; b.classList.add('count-up');
    const step = now => {
      if (!tn.isConnected) { b._counting = false; return; }
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      tn.nodeValue = pre + (k < 1 ? (target * e).toLocaleString('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : raw) + post;
      if (k < 1) raf(step); else b._counting = false;
    };
    raf(step);
  });
}
Bus.on('boot', () => {
  const c = S.current;
  if (c && !c.el.hidden && c.def.onBoot) c.def.onBoot(c.el, c.param);
});

// ==========================================================================
// AutoSaver — simpan otomatis (optimistic, draf tahan muat ulang)
// ==========================================================================
const SAVERS = new Set();
class AutoSaver {
  constructor(o) {
    this.o = o;
    this.pending = Store.get(uk(o.key), null) || {};
    this.saving = {}; this.errors = {}; this.timer = null; this.inflight = null; this.again = false;
    SAVERS.add(this);
    if (this.count()) this._schedule(800);
  }
  has(id) { return Object.prototype.hasOwnProperty.call(this.pending, id); }
  count() { return Object.keys(this.pending).length; }
  get(id) { return this.pending[id]; }
  set(id, v) { this.pending[id] = v; delete this.errors[id]; this._persist(); this.o.onState(id); this._schedule(); }
  unset(id) { delete this.pending[id]; this._persist(); this.o.onState(id); }
  clear() { const ids = Object.keys(this.pending); this.pending = {}; this.errors = {}; this._persist(); ids.forEach(id => this.o.onState(id)); }
  dispose() { clearTimeout(this.timer); SAVERS.delete(this); }
  state(id) {
    if (this.errors[id] && this.has(id)) return 'error';
    if (this.has(id) && this.saving[id] !== undefined && JSON.stringify(this.saving[id]) === JSON.stringify(this.pending[id])) return 'saving';
    if (this.has(id)) return 'draft';
    return '';
  }
  _persist() { if (this.count()) Store.set(uk(this.o.key), this.pending); else Store.del(uk(this.o.key)); }
  _schedule(ms) { clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), ms || this.o.delay || 1500); }
  async flush() {
    clearTimeout(this.timer);
    if (this.inflight) { this.again = true; return this.inflight; }
    const ids = Object.keys(this.pending);
    if (!ids.length) return;
    const batch = {};
    ids.forEach(id => { batch[id] = this.pending[id]; });
    this.saving = batch;
    ids.forEach(id => this.o.onState(id));
    this.inflight = (async () => {
      const res = await this.o.send(batch);
      this.saving = {};
      if (res.success) {
        ids.forEach(id => {
          if (JSON.stringify(this.pending[id]) === JSON.stringify(batch[id])) delete this.pending[id];
          delete this.errors[id];
        });
        this._persist();
        this.o.onSaved(res, batch);
      } else {
        const errs = res.data && res.data.errors;
        if (errs && errs.length) errs.forEach(e => { this.errors[e.id] = e.message; });
        else ids.forEach(id => { this.errors[id] = res.message || 'Gagal menyimpan'; });
        if (this.o.onFail) this.o.onFail(res, batch);
      }
      ids.forEach(id => this.o.onState(id));
    })();
    try { await this.inflight; }
    finally {
      this.inflight = null;
      if (this.again) { this.again = false; if (this.count()) this.flush(); }
    }
  }
}
function pendingDrafts() { let n = 0; SAVERS.forEach(s => { n += s.count(); }); return n; }
function flushAllSavers() { return Promise.all(Array.from(SAVERS).map(s => s.flush())); }
window.addEventListener('online', () => flushAllSavers());
window.addEventListener('beforeunload', e => { if (pendingDrafts()) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && pendingDrafts()) flushAllSavers(); });

function saveBadge(state, at, errMsg) {
  if (state === 'saving') return '<span class="badge saving">Menyimpan…</span>';
  if (state === 'draft') return '<span class="badge draft">Draf</span>';
  if (state === 'error') return '<span class="badge bad" title="' + esc(errMsg || '') + '">Gagal — ' + esc(errMsg && errMsg.length < 28 ? errMsg : 'coba lagi') + '</span>';
  if (state === 'invalid') return '<span class="badge bad">Harus 0–100</span>';
  if (at) return '<span class="badge ok">Tersimpan</span>';
  return '<span class="badge empty">Belum diisi</span>';
}

// ==========================================================================
// Status sesi penilaian harian (dipakai Dashboard, Input Nilai, Rekap)
// ==========================================================================
// --------------------------------------------------------------------------
// HAPUS BERANTAI — satu dialog untuk SEMUA tombol Hapus.
// Server menghitung dulu data yang ikut terhapus (pratinjau), lalu menghapus semuanya setelah dikonfirmasi.
// --------------------------------------------------------------------------
const HAPUS_URUTAN = ['Angkatan_Kelas', 'Peleton', 'Mata_Pelajaran', 'Users', 'Data_Gadik', 'Penugasan', 'Peserta_Didik', 'Jadwal', 'Sesi_Nilai', 'Nilai', 'Dokumen_Jadwal'];
const HAPUS_IKON = { Angkatan_Kelas: 'building', Peleton: 'layers', Mata_Pelajaran: 'book', Users: 'id-card', Data_Gadik: 'user', Penugasan: 'link', Peserta_Didik: 'users', Jadwal: 'calendar', Sesi_Nilai: 'clipboard-check', Nilai: 'pen', Dokumen_Jadwal: 'file-pdf' };

/**
 * Tampilkan dialog hapus: pratinjau dampak → konfirmasi → hapus.
 * o = { judul, nama, utama (sheet data utama, tidak diulang di daftar), extra (data tambahan ke server) }.
 * Resolve: data hasil hapus, atau null bila dibatalkan.
 */
function hapusData(jenis, id, o) {
  o = o || {};
  const extra = o.extra || {};
  return new Promise(resolve => {
    let done = false;
    const m = openModal({
      title: o.judul || 'Hapus data?', icon: 'trash', size: 'narrow', sub: o.nama || '',
      body: '<div id="hp-body" class="hp-body"><p class="hp-load"><span class="spin"></span>Memeriksa data yang berkaitan…</p></div><div id="hp-alert" class="alert red mt-16" hidden></div>',
      foot: '<button class="btn outline" data-close>Batal</button><button class="btn danger" id="hp-ok" disabled>' + icon('trash') + 'Hapus Permanen</button>',
      onClose: () => { if (!done) resolve(null); }
    });
    api('hapus', Object.assign({ jenis, id }, extra)).then(res => {
      if (!m.el.isConnected) return;
      const body = m.$('#hp-body');
      if (!res.success) { body.innerHTML = '<div class="alert red">' + icon('alert-circle') + '<div>' + esc(res.message) + '</div></div>'; return; }
      const d = res.data, L = d.labels || {}, J = d.jumlah || {};
      const ikut = HAPUS_URUTAN.filter(k => J[k] && k !== o.utama && k !== 'Data_Gadik' && !(k === 'Users' && jenis === 'akun'));
      body.innerHTML = '<p class="hp-lead"><b>' + esc(o.nama || d.label) + '</b> akan dihapus permanen' + (ikut.length ? ' <b>beserta semua data yang berkaitan</b>:' : '.') + '</p>' +
        (ikut.length ? '<ul class="hp-list">' + ikut.map(k => '<li>' + icon(HAPUS_IKON[k] || 'info', 'sm') + '<b>' + fmt.num(J[k]) + '</b><span>' + esc(L[k] || k) + '</span></li>').join('') + '</ul>' : '') +
        (d.nilai ? '<div class="alert red mt-16">' + icon('alert-triangle') + '<div><b>' + fmt.num(d.nilai) + ' data nilai ikut terhapus.</b> Rekap Harian &amp; Rekap Akhir langsung dihitung ulang tanpa nilai tersebut.</div></div>' +
          '<label class="check mt-16"><input type="checkbox" id="hp-cek"><span>Saya mengerti — data yang dihapus <b>tidak dapat dikembalikan</b>.</span></label>'
          : '<p class="small muted mt-16">Tindakan ini tidak dapat dibatalkan.</p>');
      const ok = m.$('#hp-ok'), cek = m.$('#hp-cek');
      ok.disabled = !!cek;
      if (cek) cek.addEventListener('change', () => { ok.disabled = !cek.checked; });
      else setTimeout(() => ok.focus(), 30);
      ok.onclick = async () => {
        const stop = busy(ok, 'Menghapus…');
        const r2 = await api('hapus', Object.assign({ jenis, id, konfirmasi: true }, extra));
        stop();
        if (!r2.success) { const a = m.$('#hp-alert'); a.hidden = false; a.innerHTML = icon('alert-circle') + '<div>' + esc(r2.message) + '</div>'; if (cek) ok.disabled = !cek.checked; return; }
        done = true;
        applyHapus(r2.data);
        m.close();
        const n = ikut.reduce((s, k) => s + (J[k] || 0), 0);
        toast('Data dihapus', (o.nama || d.label) + (n ? ' beserta ' + fmt.num(n) + ' data terkait' : ''));
        resolve(r2.data);
      };
    });
  });
}

/** Terapkan hasil hapus ke data lokal (tanpa memuat ulang halaman). */
function applyHapus(d) {
  const del = d.deleted || {}, set = k => new Set(del[k] || []), b = S.boot;
  if (!b) return;
  const K = set('Angkatan_Kelas'), P = set('Peleton'), M = set('Mata_Pelajaran'), PS = set('Peserta_Didik'), J = set('Jadwal'), G = set('Data_Gadik'), SE = set('Sesi_Nilai'), U = set('Users'), PN = set('Penugasan');
  if (d.ref) Object.assign(b.ref, { kelas: d.ref.kelas, peleton: d.ref.peleton, mapel: d.ref.mapel });
  else {
    b.ref.kelas = b.ref.kelas.filter(x => !K.has(x.ID_Kelas));
    b.ref.peleton = b.ref.peleton.filter(x => !P.has(x.ID_Peleton));
    b.ref.mapel = b.ref.mapel.filter(x => !M.has(x.ID_Mapel));
  }
  b.ref.gadik = (b.ref.gadik || []).filter(x => !G.has(x.ID_Gadik));
  b.peserta = b.peserta.filter(x => !PS.has(x.ID_Peserta));
  b.jadwal = b.jadwal.filter(x => !J.has(x.ID_Jadwal));
  if (d.dokumen) b.dokumen = d.dokumen;
  else if (b.dokumen && del.Dokumen_Jadwal) { const DK = set('Dokumen_Jadwal'); b.dokumen = b.dokumen.filter(x => !DK.has(x.ID_Dokumen)); }
  const st = b.stat || {};
  if (st.sesiHariIni) Object.keys(st.sesiHariIni).forEach(k => { if (J.has(k) || SE.has(st.sesiHariIni[k].ID_Sesi)) delete st.sesiHariIni[k]; });
  if (st.sesiDraf) { const n0 = st.sesiDraf.length; st.sesiDraf = st.sesiDraf.filter(x => !SE.has(x.ID_Sesi) && !J.has(x.ID_Jadwal)); st.sesiDrafTotal = Math.max(0, (st.sesiDrafTotal || 0) - (n0 - st.sesiDraf.length)); }
  if (st.kelasTotal != null) { st.kelasTotal = b.ref.kelas.length; st.kelasAktif = b.ref.kelas.filter(k => isAktif(k.Status)).length; }
  if (st.peserta != null) st.peserta = b.peserta.length;
  if (d.users && typeof applyUsers === 'function') applyUsers(d.users);
  else if (S.data.users && S.data.users.users && (U.size || PN.size)) {
    S.data.users.users = S.data.users.users.filter(u => !U.has(u.ID_User)).map(u => Object.assign(u, { penugasan: (u.penugasan || []).filter(a => !PN.has(a.ID_Penugasan)) }));
  }
  if (del.Nilai || del.Sesi_Nilai || del.Peserta_Didik || del.Jadwal) {
    S.data.rekap = {}; S.data.harian = {};
    cacheDrop(['rekap:', 'harian:']);
  }
  bootChanged();
}

// --------------------------------------------------------------------------
// PAS FOTO 4×6 — avatar akun memakai pas foto bila ada (di-cache per versi), selain itu inisial.
// --------------------------------------------------------------------------
const _fotoAntre = new Set(), _fotoMinta = {};
let _fotoT = null;
function fotoCache(uid) { return Store.get(uk('foto:' + uid), null); }
function fotoData(uid, ver) {
  if (!uid || !ver) return '';
  const c = fotoCache(uid);
  if (c && c.ver === ver && c.data) return c.data;
  if (_fotoMinta[uid] !== ver) { _fotoMinta[uid] = ver; _fotoAntre.add(uid); clearTimeout(_fotoT); _fotoT = setTimeout(ambilFoto, 60); }
  return c && c.data ? c.data : '';
}
async function ambilFoto() {
  const ids = Array.from(_fotoAntre); _fotoAntre.clear();
  for (let i = 0; i < ids.length; i += 30) {
    const res = await api('foto', { ids: ids.slice(i, i + 30) });
    if (!res.success) continue;
    Object.keys(res.data.foto).forEach(uid => {
      const f = res.data.foto[uid];
      if (f.data) Store.set(uk('foto:' + uid), f); else Store.del(uk('foto:' + uid));
      pasangFoto(uid, f.data);
    });
  }
}
function pasangFoto(uid, data) {
  $$('[data-foto="' + uid + '"]').forEach(el => {
    el.classList.toggle('has-foto', !!data);
    el.innerHTML = data ? '<img src="' + data + '" alt="" decoding="async">' : esc(el.dataset.ini || '');
  });
}
/** Avatar akun: pas foto bila ada, selain itu inisial nama. */
function avatarAkun(u, cls) {
  const ini = initials(u.Nama_Lengkap || u.Nama || ''), data = fotoData(u.ID_User, u.Foto_Ver);
  return '<div class="avatar ' + (cls || '') + (data ? ' has-foto' : '') + '" data-foto="' + esc(u.ID_User || '') + '" data-ini="' + esc(ini) + '">' + (data ? '<img src="' + data + '" alt="" decoding="async">' : esc(ini)) + '</div>';
}

/** Potong otomatis ke 4×6 (rasio 2:3, potret), perkecil 400×600 px, simpan JPEG ≤ 200 KB. pos 0–1 = geser area potong. */
function potongPasFoto(img, pos) {
  const W = 400, H = 600, r = W / H, iw = img.naturalWidth, ih = img.naturalHeight;
  let sx = 0, sy = 0, sw = iw, sh = ih;
  if (iw / ih > r) { sw = ih * r; sx = (iw - sw) * pos; } else { sh = iw / r; sy = (ih - sh) * pos; }
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.imageSmoothingQuality = 'high';
  g.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  let q = 0.9, d = c.toDataURL('image/jpeg', q);
  while (d.length * 0.75 > 200 * 1024 && q > 0.5) { q -= 0.08; d = c.toDataURL('image/jpeg', q); }
  return d;
}

/** Dialog ganti pas foto untuk akun u ({ID_User, Nama_Lengkap, Foto_Ver}). Resolve: versi baru / '' bila dihapus / null bila batal. */
function pilihPasFoto(u) {
  return new Promise(resolve => {
    let done = false, img = null, pos = 0.5, hasil = '';
    const ada = fotoData(u.ID_User, u.Foto_Ver);
    const m = openModal({
      title: 'Pas Foto 4 × 6', icon: 'camera', sub: u.Nama_Lengkap,
      body: '<div class="pf-wrap"><div class="pf-frame" id="pf-frame">' + (ada ? '<img src="' + ada + '" alt="Pas foto">' : '<div class="pf-kosong">' + icon('user') + '<span>4 × 6</span></div>') + '</div>' +
        '<div class="pf-side"><label class="drop" id="pf-drop"><input type="file" id="pf-file" accept="image/jpeg,.jpg,.jpeg" hidden><div class="icon-tile">' + icon('camera') + '</div><b>Pilih foto JPEG/JPG</b><div class="hint mt-8">atau seret berkas ke sini</div></label>' +
        '<div class="field mt-16" id="pf-pos-f" hidden><label for="pf-pos">Geser posisi foto</label><input type="range" id="pf-pos" min="0" max="100" value="50"></div>' +
        '<ul class="logo-spec"><li>Format <b>JPEG/JPG</b>, latar polos (merah/biru), wajah menghadap depan.</li><li>Otomatis dipotong ke ukuran <b>4 × 6</b> (potret) dan diperkecil 400 × 600 px.</li></ul>' +
        '<div id="pf-msg" class="mt-8"></div></div></div>',
      foot: (ada ? '<button class="btn danger-line left" id="pf-del">' + icon('trash') + 'Hapus Foto</button>' : '') + '<button class="btn outline" data-close>Batal</button><button class="btn primary" id="pf-save" disabled>' + icon('save') + 'Simpan Pas Foto</button>',
      onClose: () => { if (!done) resolve(null); }
    });
    const msg = t => { m.$('#pf-msg').innerHTML = t ? '<div class="alert red">' + icon('alert-circle') + '<div>' + esc(t) + '</div></div>' : ''; };
    const render = () => { hasil = potongPasFoto(img, pos); m.$('#pf-frame').innerHTML = '<img src="' + hasil + '" alt="Pratinjau pas foto">'; m.$('#pf-save').disabled = false; };
    const pick = f => {
      msg('');
      if (!f) return;
      if (!/^image\/(jpeg|jpg|pjpeg)$/.test(f.type) && !/\.jpe?g$/i.test(f.name)) return msg('Format harus JPEG/JPG.');
      if (f.size > 15 * 1024 * 1024) return msg('Ukuran berkas melebihi 15 MB.');
      const url = URL.createObjectURL(f), im = new Image();
      im.onload = () => { img = im; const tall = im.naturalWidth / im.naturalHeight < 2 / 3; pos = tall ? 0.3 : 0.5; m.$('#pf-pos').value = Math.round(pos * 100); m.$('#pf-pos-f').hidden = Math.abs(im.naturalWidth / im.naturalHeight - 2 / 3) < 0.01; render(); URL.revokeObjectURL(url); };
      im.onerror = () => { URL.revokeObjectURL(url); msg('Foto tidak dapat dibaca. Simpan ulang sebagai JPG lalu coba lagi.'); };
      im.src = url;
    };
    const file = m.$('#pf-file'), drop = m.$('#pf-drop');
    file.onchange = () => pick(file.files[0]);
    ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => pick(e.dataTransfer.files[0]));
    m.$('#pf-pos').addEventListener('input', e => { pos = Number(e.target.value) / 100; if (img) render(); });
    const selesai = (res, ver, data) => {
      if (data) Store.set(uk('foto:' + u.ID_User), { ver, data }); else Store.del(uk('foto:' + u.ID_User));
      u.Foto_Ver = ver;
      if (S.me && S.me.ID_User === u.ID_User) { S.me.Foto_Ver = ver; if (S.boot && S.boot.me) S.boot.me.Foto_Ver = ver; }
      const us = S.data.users && S.data.users.users; if (us) { const x = us.find(v => v.ID_User === u.ID_User); if (x) x.Foto_Ver = ver; }
      pasangFoto(u.ID_User, data);
      done = true; m.close(); resolve(ver);
    };
    m.$('#pf-save').onclick = async () => {
      if (!hasil) return;
      const stop = busy(m.$('#pf-save'), 'Menyimpan…');
      const res = await api('fotoUpload', { ID_User: u.ID_User, base64: hasil.split(',')[1] });
      stop();
      if (!res.success) return msg(res.message);
      selesai(res, res.data.Foto_Ver, res.data.data);
      toast('Pas foto disimpan', u.Nama_Lengkap);
    };
    const del = m.$('#pf-del');
    if (del) del.onclick = async () => {
      const stop = busy(del, 'Menghapus…');
      const res = await api('fotoUpload', { ID_User: u.ID_User, hapus: true });
      stop();
      if (!res.success) return msg(res.message);
      selesai(res, '', '');
      toast('Pas foto dihapus', u.Nama_Lengkap);
    };
  });
}

// --------------------------------------------------------------------------
// DOKUMEN JADWAL PELATIHAN (PDF) — kartu ringkasan dashboard + penampil PDF
// --------------------------------------------------------------------------
const _dokUrl = {};
function dokumenList() { return (S.boot && S.boot.dokumen) || []; }
function ukuranTeks(n) { return n >= 1048576 ? fmt.num(n / 1048576, 1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
function dokMeta(d) { return (d.ID_Kelas ? kelasName(d.ID_Kelas, true) : 'Semua kelas') + ' • ' + ukuranTeks(d.Ukuran) + (d.Waktu_Unggah ? ' • ' + fmt.dateTime(d.Waktu_Unggah) : ''); }
function dokItem(d, admin) {
  return '<li class="dok-item"><div class="dok-ic">' + icon('file-pdf') + '</div><div class="grow"><b>' + esc(d.Judul) + '</b><small>' + esc(dokMeta(d)) + '</small></div>' +
    '<div class="acts"><button type="button" class="btn outline xs" data-dok-lihat="' + esc(d.ID_Dokumen) + '">' + icon('eye', 'sm') + 'Lihat</button>' +
    '<button type="button" class="btn icon" data-dok-unduh="' + esc(d.ID_Dokumen) + '" title="Unduh PDF" aria-label="Unduh PDF">' + icon('download') + '</button>' +
    (admin ? '<button type="button" class="btn icon" data-dok-ubah="' + esc(d.ID_Dokumen) + '" title="Ubah / ganti berkas" aria-label="Ubah">' + icon('edit') + '</button><button type="button" class="btn icon red" data-dok-hapus="' + esc(d.ID_Dokumen) + '" title="Hapus" aria-label="Hapus">' + icon('trash') + '</button>' : '') +
    '</div></li>';
}
/** Kartu "Jadwal Pelatihan (PDF)" untuk dashboard Gadik (dan halaman Jadwal). */
function dokumenKartu(opt) {
  opt = opt || {};
  const list = dokumenList(), utama = list[0];
  return '<div class="card dok-card' + (opt.cls ? ' ' + opt.cls : '') + '"><div class="card-head"><div class="icon-tile">' + icon('file-pdf') + '</div><div class="grow"><h3>Jadwal Pelatihan</h3><div class="sub">Dokumen PDF resmi dari Admin Satdik</div></div>' +
    (opt.admin ? '<button type="button" class="btn primary sm" data-dok-baru>' + icon('upload', 'sm') + 'Unggah PDF Jadwal</button>' : (list.length ? '<span class="chip line">' + list.length + ' dokumen</span>' : '')) + '</div>' +
    '<div class="card-body">' + (list.length
      ? (!opt.admin && utama ? '<button type="button" class="dok-hero" data-dok-lihat="' + esc(utama.ID_Dokumen) + '"><span class="dok-hero-ic">' + icon('file-pdf') + '</span><span class="grow"><span class="label-mono">Terbaru</span><b>' + esc(utama.Judul) + '</b><small>' + esc(dokMeta(utama)) + '</small></span><span class="dok-hero-go">Buka' + icon('arrow-right', 'sm') + '</span></button>' : '') +
        ((opt.admin ? list : list.slice(1, 5)).length ? '<ul class="dok-list">' + (opt.admin ? list : list.slice(1, 5)).map(d => dokItem(d, opt.admin)).join('') + '</ul>' : '')
      : '<p class="muted">' + (opt.admin ? 'Belum ada dokumen. Unggah jadwal pelatihan (PDF) agar tampil di dashboard Gadik.' : 'Belum ada jadwal pelatihan (PDF) yang diunggah Admin Satdik.') + '</p>') +
    '</div></div>';
}
/** Kartu ringkasan dashboard: dokumen jadwal terbaru + tombol buka. */
function dokumenRingkas() {
  const list = dokumenList(), d = list[0];
  return '<div class="card pad dok-sum"><div class="row between"><span class="label-mono">Jadwal Pelatihan (PDF)</span><div class="icon-tile">' + icon('file-pdf') + '</div></div>' +
    (d ? '<div class="mt-8"><b class="dok-sum-t">' + esc(d.Judul) + '</b><div class="muted small mt-8">' + esc(dokMeta(d)) + '</div></div>' +
      '<button type="button" class="btn primary block mt-16" data-dok-lihat="' + esc(d.ID_Dokumen) + '">' + icon('eye', 'sm') + 'Buka Jadwal PDF</button>' +
      (list.length > 1 ? '<button type="button" class="btn outline block mt-8" data-dok-semua>' + icon('file-pdf', 'sm') + 'Semua dokumen (' + list.length + ')</button>' : '<button type="button" class="btn outline block mt-8" data-dok-unduh="' + esc(d.ID_Dokumen) + '">' + icon('download', 'sm') + 'Unduh PDF</button>')
      : '<p class="muted mt-8">Belum ada jadwal pelatihan (PDF) dari Admin Satdik.</p>') + '</div>';
}
function semuaDokumen() {
  const m = openModal({ title: 'Jadwal Pelatihan (PDF)', icon: 'file-pdf', sub: 'Dokumen resmi dari Admin Satdik', body: '<ul class="dok-list">' + dokumenList().map(d => dokItem(d, false)).join('') + '</ul>' });
  bindDokumen(m.root);
}

async function ambilDokumen(id) {
  const d = dokumenList().find(x => x.ID_Dokumen === id);
  if (!d) throw new Error('Dokumen tidak ditemukan.');
  const key = id + '|' + d.Waktu_Unggah;
  if (_dokUrl[key]) return { url: _dokUrl[key], nama: d.Nama_Berkas, d };
  const res = await api('dokumenUnduh', { id }, { timeout: 120000, tries: 2 });
  if (!res.success) throw new Error(res.message);
  const bin = atob(res.data.base64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  _dokUrl[key] = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  return { url: _dokUrl[key], nama: res.data.nama || d.Nama_Berkas, d };
}
function simpanUrl(url, nama) { const a = document.createElement('a'); a.href = url; a.download = nama || 'jadwal.pdf'; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 1000); }
async function lihatDokumen(id) {
  const d = dokumenList().find(x => x.ID_Dokumen === id);
  if (!d) return;
  const m = openModal({
    title: d.Judul, icon: 'file-pdf', sub: dokMeta(d), size: 'pdf',
    body: '<div class="pdf-box" id="pdf-box"><p class="hp-load"><span class="spin"></span>Memuat dokumen…</p></div>',
    foot: '<button class="btn outline" data-close>Tutup</button><a class="btn outline" id="pdf-tab" target="_blank" rel="noopener" hidden>' + icon('external') + 'Buka di tab baru</a><button class="btn primary" id="pdf-dl" disabled>' + icon('download') + 'Unduh PDF</button>'
  });
  try {
    const r = await ambilDokumen(id);
    if (!m.el.isConnected) return;
    const lebar = window.matchMedia('(min-width: 760px) and (pointer: fine)').matches;
    m.$('#pdf-box').innerHTML = lebar
      ? '<iframe class="pdf-frame" src="' + r.url + '#view=FitH" title="' + esc(d.Judul) + '"></iframe>'
      : '<div class="pdf-hp">' + icon('file-pdf') + '<b>' + esc(d.Judul) + '</b><p class="muted small">' + esc(ukuranTeks(d.Ukuran)) + ' • PDF</p><a class="btn primary block mt-16" href="' + r.url + '" target="_blank" rel="noopener">' + icon('external') + 'Buka PDF</a></div>';
    const tab = m.$('#pdf-tab'); tab.href = r.url; tab.hidden = false;
    const dl = m.$('#pdf-dl'); dl.disabled = false; dl.onclick = () => simpanUrl(r.url, r.nama);
  } catch (e) {
    if (m.el.isConnected) m.$('#pdf-box').innerHTML = '<div class="alert red">' + icon('alert-circle') + '<div>' + esc(e.message) + '</div></div>';
  }
}
async function unduhDokumen(id, btn) {
  const stop = busy(btn);
  try { const r = await ambilDokumen(id); simpanUrl(r.url, r.nama); }
  catch (e) { toast('Gagal mengunduh', e.message, 'error'); }
  finally { stop(); }
}
/** Pasang klik Lihat/Unduh pada satu elemen akar (sekali saja). */
function bindDokumen(root) {
  if (!root || root._dokBound) return;
  root._dokBound = true;
  root.addEventListener('click', e => {
    const l = e.target.closest('[data-dok-lihat]'); if (l) return lihatDokumen(l.dataset.dokLihat);
    const u = e.target.closest('[data-dok-unduh]'); if (u) return unduhDokumen(u.dataset.dokUnduh, u);
    if (e.target.closest('[data-dok-semua]')) return semuaDokumen();
  });
}

function pesertaCount(idKelas) { return S.boot.peserta.filter(p => p.ID_Kelas === idKelas).length; }
function sesiBadge(info, total) {
  if (!info) return '<span class="badge empty">Belum diisi</span>';
  if (info.Status === 'Selesai') return '<span class="badge ok">Masuk rekap</span>';
  return '<span class="badge draft">Draf' + (total ? ' · ' + (info.Jumlah || 0) + '/' + total : '') + '</span>';
}
/** Status sesi hari ini dari bootstrap (kosong bila bootstrap dari hari lain). */
function todaySesiStat() {
  const st = S.boot && S.boot.stat;
  return st && st.sesiHariIni && S.boot.today === todayStr() ? st.sesiHariIni : {};
}
/** Perbarui ringkasan status sesi di bootstrap setelah simpan / selesai / buka kunci. */
function sesiStatUpdate(info) {
  const st = S.boot && S.boot.stat;
  if (!st || !info || !st.sesiHariIni) return;
  const slim = { ID_Sesi: info.ID_Sesi, Tanggal: info.Tanggal, ID_Jadwal: info.ID_Jadwal, ID_Kelas: info.ID_Kelas, ID_Mapel: info.ID_Mapel, ID_Gadik: info.ID_Gadik, Status: info.Status, Jumlah: info.Jumlah };
  if (info.Tanggal === S.boot.today) st.sesiHariIni[info.ID_Jadwal] = slim;
  const same = x => x.Tanggal === info.Tanggal && x.ID_Jadwal === info.ID_Jadwal;
  const before = (st.sesiDraf || []).length, list = (st.sesiDraf || []).filter(x => !same(x));
  if (info.Status !== 'Selesai') list.push(slim);
  list.sort((a, b) => b.Tanggal.localeCompare(a.Tanggal));
  st.sesiDrafTotal = Math.max(list.length, (st.sesiDrafTotal || 0) + list.length - before);
  st.sesiDraf = list.slice(0, 30);
  cachePut('boot', S.boot);
}
function nilaiHref(tgl, jid) { return '#/nilai/' + tgl + (jid ? '/' + encodeURIComponent(jid) : ''); }

// ==========================================================================
// DASHBOARD (US-03, US-04)
// ==========================================================================
page('dashboard', {
  title: 'Dashboard',
  show(el) { renderDashboard(el); },
  onBoot(el) { renderDashboard(el); }
});

function renderDashboard(el) {
  bindDokumen(el);
  if (S.role === 'Admin') return dashAdmin(el);
  if (S.role === 'Gadik') return dashGadik(el);
  el.innerHTML = emptyState('lock', 'Peran tidak dikenali', 'Peran akun ini sudah tidak digunakan di SIPL. Hubungi Admin Satdik.');
}

function shortcut(href, ic, title, text, go, tone) {
  return '<a class="shortcut ' + (tone || '') + '" href="#/' + href + '"><div class="icon-tile' + (tone === 'red' ? ' red' : '') + '">' + icon(ic) + '</div><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p><span class="go">' + esc(go || 'Buka modul') + icon('arrow-right', 'sm') + '</span></a>';
}

function dashAdmin(el) {
  const b = S.boot, st = b.stat || {}, conf = findConflicts(b.jadwal);
  const nConf = Math.round(Object.keys(conf).reduce((s, k) => s + conf[k].length, 0) / 2);
  const ss = todaySesiStat(), today = todaySessions(b.jadwal);
  const nDone = today.filter(j => ss[j.ID_Jadwal] && ss[j.ID_Jadwal].Status === 'Selesai').length;
  const draf = st.sesiDrafTotal || 0;
  el.innerHTML =
    pageHead({
      eyebrow: (CFG.TAHUN_AJARAN ? 'TA ' + CFG.TAHUN_AJARAN + ' // ' : '') + 'Sistem Informasi Pelatihan',
      title: 'Dashboard Administrator',
      desc: 'Pusat kendali data pelatihan, jadwal pelajaran, tenaga pendidik (Gadik), serta rekap penilaian ' + esc(CFG.INSTANSI || 'SPN Polda Papua Barat') + '.',
      chips: roleBadge('Admin'),
      actions: '<a class="btn outline" href="#/jadwal">' + icon('calendar') + 'Atur Jadwal</a><a class="btn primary" href="#/akun/baru">' + icon('user-plus') + 'Tambah Akun</a>'
    }) +
    '<div class="grid c4 keep2">' +
      stat({ label: 'Kelas Aktif', value: st.kelasAktif || 0, unit: 'kelas', icon: 'building', cap: (st.kelasTotal || 0) + ' angkatan/kelas pelatihan terdaftar' }) +
      stat({ label: 'Gadik', value: st.gadik || 0, unit: 'personel', icon: 'book', cap: 'Tenaga pendidik aktif' }) +
      stat({ label: 'Mata Pelajaran', value: b.ref.mapel.filter(m => isAktif(m.Status)).length, unit: 'mapel', icon: 'layers', cap: '1 mapel = 6 hari pelatihan' }) +
      stat({ label: 'Peserta Pelatihan', value: st.peserta || 0, unit: 'orang', icon: 'users', cap: 'Terdaftar di seluruh kelas' }) +
    '</div>' +
    (nConf ? '<div class="notice red mt-24"><div class="icon-tile">' + icon('alert-triangle') + '</div><div class="grow"><b>' + nConf + ' bentrok jadwal terdeteksi</b><p>Ada Gadik atau kelas yang dijadwalkan pada jam yang sama. Selesaikan agar jadwal valid.</p></div><a class="btn danger sm" href="#/jadwal">Tinjau jadwal</a></div>' : '') +
    '<div class="card mt-24"><div class="card-head"><div class="icon-tile">' + icon('clipboard-check') + '</div><div class="grow"><h3>Nilai Harian Hari Ini</h3><div class="sub">' + esc(fmt.tgl(todayStr(), { hari: true })) + ' • nilai masuk rekap setelah Gadik menekan “Selesai”</div></div>' +
      (today.length ? '<span class="chip' + (nDone === today.length ? '' : ' line') + '">' + nDone + '/' + today.length + ' sesi masuk rekap</span>' : '') +
      (draf ? '<a class="chip red" href="#/rekap">' + draf + ' sesi draf (semua tanggal)</a>' : '') + '</div>' +
      (today.length ? '<div class="table-wrap"><table class="dt cards"><thead><tr><th>Jam</th><th>Mata Pelajaran</th><th>Kelas</th><th>Gadik</th><th>Status Nilai</th></tr></thead><tbody>' +
        today.slice(0, 12).map(j => '<tr><td data-label="Jam" class="mono nowrap">' + esc(fmt.jam(j.Jam_Mulai)) + '–' + esc(fmt.jam(j.Jam_Selesai)) + '</td>' +
          '<td data-label="Mapel" class="card-title"><b>' + esc(mapelName(j.ID_Mapel)) + '</b></td>' +
          '<td data-label="Kelas">' + esc(kelasName(j.ID_Kelas)) + '</td>' +
          '<td data-label="Gadik">' + esc(gadikName(j.ID_Gadik)) + '</td>' +
          '<td data-label="Status">' + sesiBadge(ss[j.ID_Jadwal], pesertaCount(j.ID_Kelas)) + '</td></tr>').join('') +
        '</tbody></table></div>' + (today.length > 12 ? '<div class="pager"><span>dan ' + (today.length - 12) + ' sesi lainnya</span></div>' : '')
        : '<div class="card-body">' + emptyState('calendar', 'Tidak ada sesi pelajaran hari ini', 'Belum ada jadwal pada hari ' + nowWIT().hari + '.') + '</div>') +
    '</div>' +
    '<div class="section-title"><h2>Menu Pintas</h2><span class="label-mono">Administrator</span></div>' +
    '<div class="grid c4">' +
      shortcut('personel', 'id-card', 'Personel & Akun', 'Kelola akun login Gadik, pas foto, reset password, dan penugasan kelas.') +
      shortcut('jadwal', 'calendar', 'Jadwal Pelajaran', 'Matriks jadwal mingguan per kelas dengan deteksi bentrok Gadik dan kelas otomatis.') +
      shortcut('rekap-akhir', 'medal', 'Rekap Akhir', 'NIL AKHIR & peringkat per kelas sesuai format PROLAT, siap diunduh PDF/Excel.') +
      shortcut('master', 'database', 'Master Data', 'Angkatan & kelas pelatihan, peleton, mata pelajaran, dan penugasan personel.') +
    '</div>';
}

function todaySessions(jadwal) {
  const now = nowWIT();
  const t = todayStr();
  return jadwal.filter(j => jadwalAktif(j, t)).sort((a, b) => menit(a.Jam_Mulai) - menit(b.Jam_Mulai));
}
function sessionState(j, now) {
  if (!jadwalAktif(j, todayStr())) return '';
  if (now.min >= menit(j.Jam_Selesai)) return 'done';
  if (now.min >= menit(j.Jam_Mulai)) return 'now';
  return 'next';
}
function sessionBadge(state) {
  if (state === 'done') return '<span class="badge ok">Selesai</span>';
  if (state === 'now') return '<span class="badge live">Berlangsung</span>';
  if (state === 'next') return '<span class="badge empty">Akan datang</span>';
  return '';
}
function sessionCard(j, i, showKelas, side) {
  const now = nowWIT(), stt = sessionState(j, now);
  return '<div class="session ' + (stt === 'now' ? 'now' : stt === 'done' && !side ? 'done' : '') + '"><div class="no"><small>SESI</small><b>' + pad2(i + 1) + '</b></div>' +
    '<div class="grow"><div class="row" style="gap:8px"><span class="time">' + esc(fmt.jam(j.Jam_Mulai)) + '–' + esc(fmt.jam(j.Jam_Selesai)) + ' WIT</span>' + (showKelas ? '<span class="chip">' + esc(kelasName(j.ID_Kelas)) + '</span>' : '') + sessionBadge(stt) + '</div>' +
    '<h3 class="mt-8">' + esc(mapelName(j.ID_Mapel)) + '</h3>' +
    '<div class="meta"><span>' + icon('user', 'sm') + esc(gadikName(j.ID_Gadik)) + '</span>' + (j.Ruang ? '<span>' + icon('map-pin', 'sm') + esc(j.Ruang) + '</span>' : '') + '</div></div>' +
    (side ? '<div class="sess-act">' + side + '</div>' : '') + '</div>';
}

function dashGadik(el) {
  const b = S.boot, me = S.me, kelas = kelasList(), now = nowWIT(), tgl = todayStr();
  const mine = b.jadwal.filter(j => j.ID_Gadik === me.ID_Gadik);
  const mapelIds = Array.from(new Set(mine.map(j => j.ID_Mapel))).sort((x, y) => collator.compare(mapelName(x), mapelName(y)));
  const today = todaySessions(mine), ss = todaySesiStat();
  const nDone = today.filter(j => ss[j.ID_Jadwal] && ss[j.ID_Jadwal].Status === 'Selesai').length;
  const pct = today.length ? Math.round(nDone / today.length * 100) : 0;
  const draf = ((b.stat && b.stat.sesiDraf) || []).filter(x => x.Tanggal !== tgl && mine.some(j => j.ID_Jadwal === x.ID_Jadwal));
  const besok = addDays(tgl, 1), awal = mine.filter(j => bolehIsiAwal(j, besok));
  el.innerHTML =
    pageHead({
      eyebrow: 'Penilaian Harian // Tenaga Pendidik',
      title: 'Dashboard Gadik',
      desc: 'Selamat datang, <b>' + esc(me.Nama_Lengkap) + '</b>' + (me.NRP ? ' <span class="nrp">NRP ' + esc(me.NRP) + '</span>' : '') + '. Input nilai harian setiap sesi yang Anda ajar, lalu kirim ke rekap.',
      chips: roleBadge('Gadik') + '<span class="chip">' + icon('lock', 'sm') + 'Isolasi kelas sendiri</span>',
      actions: today.length ? '<a class="btn primary" href="' + nilaiHref(tgl) + '">' + icon('pen') + 'Input Nilai Hari Ini</a>' : ''
    }) +
    '<div class="notice"><div class="icon-tile">' + icon('shield-check') + '</div><div><b>Hak akses terbatas pada kelas penugasan</b><p>Anda hanya dapat melihat dan mengubah data peserta serta nilai sesi yang Anda ajar di kelas penugasan. Data kelas lain tidak dapat diakses.</p></div></div>' +
    (awal.length ? '<div class="notice"><div class="icon-tile">' + icon('calendar') + '</div><div class="grow"><b>Penutupan dimajukan ke Jumat</b><p>Nilai hari Sabtu (' + esc(fmt.tgl(besok, { short: true })) + ') sudah dapat diisi hari ini.</p><div class="draf-list">' +
      awal.map(j => '<a class="btn primary xs" href="' + nilaiHref(besok, j.ID_Jadwal) + '">' + icon('pen', 'sm') + 'Isi nilai Sabtu • ' + esc(mapelName(j.ID_Mapel)) + ' (' + esc(kelasName(j.ID_Kelas)) + ')</a>').join('') + '</div></div></div>' : '') +
    (kelas.length ? '' : '<div class="notice red"><div class="icon-tile">' + icon('alert-triangle') + '</div><div><b>Belum ada penugasan kelas</b><p>Hubungi Admin Satdik agar akun Anda ditugaskan ke kelas.</p></div></div>') +
    '<div class="grid c4 dash-sum">' +
      '<div class="card pad"><div class="row between"><span class="label-mono">Kelas Binaan</span><div class="icon-tile">' + icon('building') + '</div></div>' +
        (kelas.length ? kelas.map(k => '<div class="mt-8"><b style="font-size:18px">' + esc(k.Nama_Kelas) + '</b><div class="muted small">' + esc(k.Nama_Angkatan) + ' • <span class="mono">' + pesertaCount(k.ID_Kelas) + '</span> peserta</div></div>').join('') : '<p class="muted mt-8">—</p>') + '</div>' +
      '<div class="card pad"><div class="row between"><span class="label-mono">Mata Pelajaran Diampu</span><div class="icon-tile">' + icon('book') + '</div></div>' +
        (mapelIds.length ? mapelIds.map(m => '<div class="mt-8"><b>' + esc(mapelName(m)) + '</b><div class="muted small">' + mine.filter(j => j.ID_Mapel === m).sort((a, b) => String(b.Tanggal_Mulai).localeCompare(String(a.Tanggal_Mulai))).slice(0, 2).map(j => esc(rentangJadwal(j))).join('<br>') + '</div></div>').join('') : '<p class="muted mt-8">Belum ada jadwal mengajar.</p>') + '</div>' +
      '<div class="card pad"><div class="row between"><span class="label-mono">Nilai Harian Hari Ini</span><div class="icon-tile">' + icon('clipboard-check') + '</div></div>' +
        (today.length
          ? '<div class="stat" style="border:0;box-shadow:none;padding:0;min-height:0;margin-top:8px"><div class="big">' + nDone + '<small>/ ' + today.length + ' sesi</small></div></div>' +
            '<div class="progress lg mt-8"><span style="width:' + pct + '%"></span></div><div class="small muted mt-8">' + (nDone === today.length ? 'Semua sesi hari ini sudah masuk rekap.' : (today.length - nDone) + ' sesi belum dikirim ke rekap') + '</div>' +
            '<a class="btn primary block mt-16" href="' + nilaiHref(tgl) + '">Input nilai hari ini' + icon('arrow-right', 'sm') + '</a>'
          : '<p class="muted mt-8">Tidak ada sesi mengajar hari ' + esc(now.hari) + '.</p><a class="btn outline block mt-16" href="#/nilai">Buka Input Nilai</a>') + '</div>' +
      dokumenRingkas() +
    '</div>' +
    (draf.length ? '<div class="notice red mt-24"><div class="icon-tile">' + icon('clock') + '</div><div class="grow"><b>' + draf.length + ' sesi sebelumnya belum dikirim ke rekap</b><p>Nilai draf belum dihitung di rekap sampai Anda menekan “Selesai &amp; Kirim ke Rekap”.</p><div class="draf-list">' +
      draf.slice(0, 6).map(x => '<a class="btn outline xs" href="' + nilaiHref(x.Tanggal, x.ID_Jadwal) + '">' + esc(fmt.tgl(x.Tanggal, { hari: true, short: true })) + ' • ' + esc(mapelName(x.ID_Mapel)) + ' (' + esc(kelasName(x.ID_Kelas)) + ')' + icon('arrow-right', 'sm') + '</a>').join('') + '</div></div></div>' : '') +
    '<div class="card mt-24"><div class="card-head"><div class="icon-tile">' + icon('clock') + '</div><div class="grow"><h3>Sesi Mengajar Hari Ini (' + esc(now.hari) + ')</h3><div class="sub">' + esc(fmt.tgl(tgl)) + ' • Zona waktu WIT (UTC+9)</div></div></div>' +
      '<div class="card-body">' + (today.length ? '<div class="sessions">' + today.map((j, i) => {
        const s = ss[j.ID_Jadwal], done = s && s.Status === 'Selesai';
        return sessionCard(j, i, true, sesiBadge(s, pesertaCount(j.ID_Kelas)) + '<a class="btn ' + (done ? 'outline' : 'primary') + ' sm" href="' + nilaiHref(tgl, j.ID_Jadwal) + '">' + (done ? icon('eye', 'sm') + 'Lihat nilai' : icon('pen', 'sm') + 'Input nilai') + '</a>');
      }).join('') + '</div>' : emptyState('calendar', 'Tidak ada sesi mengajar hari ini', 'Jadwal mengajar Anda kosong untuk hari ' + now.hari + '.')) + '</div></div>' +
    '<div class="section-title"><h2>Menu Pintas</h2><span class="label-mono">Aksi cepat</span></div>' +
    '<div class="grid c4">' +
      shortcut('nilai', 'pen', 'Input Nilai Harian', 'Pilih tanggal dan sesi, isi skor A1–C2 (0–10), lalu kirim ke rekap. Draf tersimpan otomatis.', 'Mulai input') +
      shortcut('rekap-akhir', 'medal', 'Rekap Akhir', 'NIL AKHIR & peringkat kelas Anda, bisa diunduh PDF/Excel.', 'Lihat rekap') +
      shortcut('peserta', 'users', 'Data Peserta Pelatihan', 'Tambah dan perbarui nama, pangkat, NRP, dan peleton peserta di kelas Anda.', 'Buka daftar') +
      shortcut('jadwal', 'calendar', 'Jadwal Kelas', 'Lihat jadwal pelajaran mingguan kelas Anda beserta pengajar dan ruangan.', 'Lihat jadwal') +
    '</div>';
}

// ==========================================================================
// PESERTA PELATIHAN (US-09, US-13)
// ==========================================================================
const PesertaPage = (() => {
  const st = { kelas: '', pel: '', q: '' };
  let el, table;

  function canEdit() { return S.role === 'Gadik'; }
  function canDel() { return S.role === 'Gadik' || S.role === 'Admin'; }
  function myKelas() { return kelasList(); }

  function build(root) {
    el = root;
    const multi = S.role === 'Admin' || myKelas().length > 1;
    el.innerHTML =
      pageHead({
        eyebrow: S.role === 'Admin' ? 'Data Peserta Pelatihan // Semua Kelas' : 'Data Peserta Pelatihan // Isolasi Kelas Binaan',
        title: 'Peserta Pelatihan',
        desc: S.role === 'Gadik' ? 'Daftar resmi peserta di kelas penugasan Anda. Anda dapat menambah dan memperbarui nama, pangkat, NRP, dan peleton.' :
          'Daftar peserta pelatihan seluruh kelas. Data diinput oleh Gadik di masing-masing kelas; Admin dapat menghapus peserta beserta seluruh nilainya.',
        chips: S.role === 'Admin' ? '<span class="chip line">' + icon('eye', 'sm') + 'Lihat &amp; hapus</span>' : '<span class="chip">' + icon('lock', 'sm') + 'Kelas penugasan' + '</span>',
        actions: canEdit() ? '<button class="btn primary" id="ps-add">' + icon('user-plus') + 'Tambah Peserta</button>' : ''
      }) +
      '<div class="grid c3 keep2" id="ps-stats"></div>' +
      '<div class="card mt-24"><div class="toolbar">' +
        '<div class="field' + (multi ? '' : ' narrow') + '"><label for="ps-kelas">Kelas</label><select id="ps-kelas" class="select"></select></div>' +
        '<div class="field narrow"><label for="ps-pel">Peleton</label><select id="ps-pel" class="select"></select></div>' +
        '<div class="field search"><label for="ps-q">Cari peserta</label><div class="input-wrap">' + icon('search', 'lead') + '<input id="ps-q" class="input with-lead" placeholder="Nama atau NRP…" autocomplete="off"></div></div>' +
      '</div><div id="ps-table"></div></div>';
    table = new Table($('#ps-table', el), {
      key: 'ID_Peserta', unit: 'peserta', pageSize: 25, sort: { key: 'Nama_Lengkap', dir: 'asc' },
      columns: columns(),
      empty: () => emptyState('users', 'Belum ada peserta', st.q ? 'Tidak ada peserta yang cocok dengan pencarian.' : 'Belum ada peserta di kelas/peleton ini.', canEdit() && !st.q ? '<button class="btn primary" data-act="add">' + icon('plus') + 'Tambah Peserta</button>' : ''),
      onAction: (act, id) => {
        if (act === 'add') return openForm();
        if (act === 'edit' && canEdit()) return openForm(R().peserta[id]);
        if (act === 'del') return remove(R().peserta[id]);
      }
    });
    $('#ps-kelas', el).addEventListener('change', e => { st.kelas = e.target.value; st.pel = ''; fillPel(); refresh(); });
    $('#ps-pel', el).addEventListener('change', e => { st.pel = e.target.value; refresh(); });
    $('#ps-q', el).addEventListener('input', debounce(e => { st.q = e.target.value; refresh(); }, 250));
    const add = $('#ps-add', el);
    if (add) add.onclick = () => openForm();
  }

  function columns() {
    const cols = [
      { key: 'no', label: 'No', sort: false, cls: 'no', render: (r, i) => pad2(i + 1) },
      { key: 'NRP', label: 'NRP', render: r => '<span class="nrp">' + esc(r.NRP) + '</span>', cls: 'nowrap' },
      { key: 'Nama_Lengkap', label: 'Nama Lengkap', cls: 'card-title', render: r => '<div class="t-person"><div class="avatar sm">' + esc(initials(r.Nama_Lengkap)) + '</div><div class="t-name"><b>' + esc(r.Nama_Lengkap) + '</b><small>' + esc(r.Pangkat || '—') + '</small></div></div>' },
      { key: 'Pangkat', label: 'Pangkat', render: r => r.Pangkat ? esc(r.Pangkat) : '<span class="faint">—</span>' }
    ];
    if (S.role === 'Admin' || myKelas().length > 1) cols.push({ key: 'kelas', label: 'Kelas', sort: r => kelasName(r.ID_Kelas, true), render: r => esc(kelasName(r.ID_Kelas)) + '<div class="faint small">' + esc((R().kelas[r.ID_Kelas] || {}).Nama_Angkatan || '') + '</div>' });
    cols.push({ key: 'pel', label: 'Peleton', sort: r => pelName(r.ID_Peleton), render: r => r.ID_Peleton ? '<span class="chip line">' + esc(pelName(r.ID_Peleton)) + '</span>' : '<span class="faint">—</span>' });
    if (canDel()) cols.push({ key: 'acts', label: 'Aksi', sort: false, cls: 'acts-cell', render: () => '<div class="acts">' + (canEdit() ? '<button class="btn icon" data-act="edit" title="Ubah">' + icon('edit') + '</button>' : '') + '<button class="btn icon red" data-act="del" title="Hapus peserta">' + icon('trash') + '</button></div>' });
    return cols;
  }

  function fillKelas() {
    const list = myKelas();
    if (S.role !== 'Admin' && list.length && !list.some(k => k.ID_Kelas === st.kelas)) st.kelas = list[0].ID_Kelas;
    if (S.role === 'Admin' && st.kelas && !R().kelas[st.kelas]) st.kelas = '';
    const sel = $('#ps-kelas', el);
    sel.innerHTML = options(list, 'ID_Kelas', k => k.Nama_Kelas + ' — ' + k.Nama_Angkatan, st.kelas, S.role === 'Admin' ? 'Semua kelas' : null);
    sel.disabled = S.role !== 'Admin' && list.length <= 1;
  }
  function fillPel() {
    const list = pelOf(st.kelas);
    if (st.pel && !list.some(p => p.ID_Peleton === st.pel)) st.pel = '';
    $('#ps-pel', el).innerHTML = options(list, 'ID_Peleton', p => p.Nama_Peleton + (st.kelas ? '' : ' (' + kelasName(p.ID_Kelas) + ')'), st.pel, 'Semua peleton');
  }

  function filtered() {
    const q = norm(st.q);
    return S.boot.peserta.filter(p =>
      (!st.kelas || p.ID_Kelas === st.kelas) && (!st.pel || p.ID_Peleton === st.pel) &&
      (!q || norm(p.Nama_Lengkap).indexOf(q) > -1 || String(p.NRP).indexOf(q) > -1));
  }

  function refresh(keepPage) {
    const rows = filtered();
    const scope = S.boot.peserta.filter(p => !st.kelas || p.ID_Kelas === st.kelas);
    const pels = pelOf(st.kelas);
    $('#ps-stats', el).innerHTML =
      stat({ label: 'Total Peserta', value: scope.length, unit: 'siswa', icon: 'users', cap: st.kelas ? esc(kelasName(st.kelas, true)) : 'Semua kelas dalam akses Anda' }) +
      stat({ label: 'Peleton', value: pels.length, unit: 'peleton', icon: 'layers', cap: pels.map(p => esc(p.Nama_Peleton) + ' (' + scope.filter(x => x.ID_Peleton === p.ID_Peleton).length + ')').join(' • ') || '—' }) +
      stat({ label: 'Hasil Filter', value: rows.length, unit: 'peserta', icon: 'filter', cap: st.q ? 'Kata kunci: “' + esc(st.q) + '”' : 'Gunakan pencarian nama atau NRP' });
    table.set(rows, keepPage);
  }

  function openForm(p) {
    const isEdit = !!p;
    const kel = myKelas();
    const kSel = isEdit ? p.ID_Kelas : (st.kelas || (kel[0] && kel[0].ID_Kelas) || '');
    if (!kel.length) { toast('Belum ada kelas', 'Akun Anda belum ditugaskan ke kelas. Hubungi Admin Satdik.', 'warning'); return; }
    const m = openModal({
      title: (isEdit ? 'Ubah Peserta — ' : 'Tambah Peserta — ') + kelasName(kSel), sub: 'Registrasi peserta pelatihan', icon: isEdit ? 'edit' : 'user-plus',
      body: '<form id="pf" class="form-grid" novalidate>' +
        '<div id="pf-alert" class="alert red span-all" hidden></div>' +
        '<div class="field"><label>NRP <span class="req">*</span><span class="tag">Wajib unik</span></label><input name="NRP" class="input mono" value="' + esc(isEdit ? p.NRP : '') + '" maxlength="25" placeholder="Contoh: 03051004" autocomplete="off"><div class="hint">Angka/huruf tanpa spasi. NRP tidak boleh sama dengan peserta lain.</div></div>' +
        '<div class="field"><label>Pangkat</label><input name="Pangkat" class="input" value="' + esc(isEdit ? p.Pangkat : '') + '" maxlength="40" placeholder="Contoh: BRIPDA"></div>' +
        '<div class="field span-all"><label>Nama Lengkap <span class="req">*</span></label><input name="Nama_Lengkap" class="input" value="' + esc(isEdit ? p.Nama_Lengkap : '') + '" maxlength="120" placeholder="Contoh: Daniel Krey"></div>' +
        '<div class="field"><label>Kelas <span class="req">*</span></label><select name="ID_Kelas" class="select"' + (kel.length <= 1 ? ' disabled' : '') + '>' + options(kel, 'ID_Kelas', k => k.Nama_Kelas + ' — ' + k.Nama_Angkatan, kSel) + '</select></div>' +
        '<div class="field"><label>Peleton <span class="req">*</span></label><select name="ID_Peleton" class="select"></select></div>' +
        '</form>',
      foot: '<button class="btn outline" data-close>Batal</button><button class="btn primary" id="pf-save">' + icon('save') + 'Simpan Data Peserta</button>'
    });
    const form = m.$('#pf'), selK = form.querySelector('[name=ID_Kelas]'), selP = form.querySelector('[name=ID_Peleton]');
    const fillP = () => {
      const list = pelOf(selK.value);
      selP.innerHTML = options(list, 'ID_Peleton', x => x.Nama_Peleton, isEdit ? p.ID_Peleton : st.pel, list.length ? 'Pilih peleton' : 'Kelas ini belum punya peleton');
    };
    fillP();
    selK.addEventListener('change', fillP);
    form.addEventListener('submit', e => { e.preventDefault(); m.$('#pf-save').click(); });
    m.$('#pf-save').onclick = async () => {
      clearErrors(form); m.$('#pf-alert').hidden = true;
      const v = formValues(form);
      v.ID_Kelas = selK.value;
      if (!v.NRP) return fieldError(form, 'NRP', 'NRP wajib diisi.');
      if (!v.Nama_Lengkap) return fieldError(form, 'Nama_Lengkap', 'Nama lengkap wajib diisi.');
      if (!v.ID_Peleton && pelOf(v.ID_Kelas).length) return fieldError(form, 'ID_Peleton', 'Pilih peleton peserta.');
      const dup = S.boot.peserta.find(x => x.NRP.toUpperCase() === v.NRP.replace(/\s+/g, '').toUpperCase() && (!isEdit || x.ID_Peserta !== p.ID_Peserta));
      if (dup) return fieldError(form, 'NRP', 'NRP ' + v.NRP + ' sudah terdaftar atas nama ' + dup.Nama_Lengkap + '. Setiap NRP harus unik.');
      if (isEdit) v.ID_Peserta = p.ID_Peserta;
      const done = busy(m.$('#pf-save'), 'Menyimpan…');
      const res = await api('pesertaSave', v);
      done();
      if (!res.success) return showServerError(form, res, '#pf-alert');
      const rec = res.data.peserta, list = S.boot.peserta, i = list.findIndex(x => x.ID_Peserta === rec.ID_Peserta);
      if (i > -1) list[i] = rec; else list.push(rec);
      bootChanged();
      m.close();
      toast(isEdit ? 'Data peserta diperbarui' : 'Peserta ditambahkan', rec.Nama_Lengkap + ' • NRP ' + rec.NRP);
      refresh(true);
    };
  }

  async function remove(p) {
    if (!p) return;
    const r = await hapusData('peserta', p.ID_Peserta, { judul: 'Hapus peserta?', nama: p.Nama_Lengkap + ' (NRP ' + p.NRP + ')', utama: 'Peserta_Didik' });
    if (r) refresh(true);
  }

  return {
    title: 'Peserta Pelatihan',
    show(root, param, o) { if (o.isNew || !table) build(root); fillKelas(); fillPel(); refresh(!o.isNew); },
    onBoot() { if (!el) return; fillKelas(); fillPel(); refresh(true); }
  };
})();
page('peserta', PesertaPage);

// ==========================================================================
// JADWAL — lihat saja (Gadik). Admin memakai versi admin.js.
// ==========================================================================
const JadwalView = (() => {
  const st = { kelas: '', tgl: '' };
  let el;
  const senin = t => addDays(t, -HARI.indexOf(hariOf(t)));
  function render() {
    const kel = kelasList(), today = todayStr();
    if (!kel.some(k => k.ID_Kelas === st.kelas)) st.kelas = kel[0] ? kel[0].ID_Kelas : '';
    if (!st.tgl) st.tgl = hariOf(today) === 'Minggu' ? addDays(today, 1) : today;
    const wk = senin(st.tgl), dates = HARI.map((h, i) => addDays(wk, i));
    const all = S.boot.jadwal.filter(j => j.ID_Kelas === st.kelas);
    const week = all.filter(j => dates.some(t => jadwalAktif(j, t)));
    const days = dates.filter((t, i) => i < 6 || week.some(j => jadwalAktif(j, t)));
    const list = all.filter(j => jadwalAktif(j, st.tgl)).sort((a, b) => menit(a.Jam_Mulai) - menit(b.Jam_Mulai));
    const mapelPekan = Array.from(new Set(week.map(j => j.ID_Mapel)));
    const upcoming = all.filter(j => j.Tanggal_Selesai && j.Tanggal_Selesai >= today).sort((a, b) => a.Tanggal_Mulai.localeCompare(b.Tanggal_Mulai));
    el.innerHTML =
      pageHead({
        eyebrow: 'Jadwal Resmi Kelas Binaan // Mode Lihat Saja',
        title: 'Jadwal Pelajaran',
        desc: st.kelas ? esc(kelasName(st.kelas, true)) + ' • 1 mata pelajaran = 6 hari (Senin–Sabtu), 08.00–17.00 WIT' : 'Belum ada kelas yang ditugaskan.',
        chips: '<span class="chip line">' + icon('eye', 'sm') + 'Hanya lihat</span>',
        actions: kel.length > 1 ? '<select class="select" id="jv-kelas" style="min-width:240px">' + options(kel, 'ID_Kelas', k => k.Nama_Kelas + ' — ' + k.Nama_Angkatan, st.kelas) + '</select>' : ''
      }) +
      '<div class="notice"><div class="icon-tile">' + icon('lock') + '</div><div><b>Tampilan terisolasi (lihat saja)</b><p>Gadik tidak dapat mengubah jadwal. Hubungi Admin Satdik untuk permohonan perubahan tanggal, jam, atau tukar mengajar.</p></div></div>' +
      (dokumenList().length ? dokumenKartu({ cls: 'mb-24' }) : '') +
      '<div class="card"><div class="card-head" style="flex-wrap:wrap"><div class="wk-nav"><button class="btn icon" data-wk="-7" aria-label="Pekan sebelumnya">' + icon('chevron-left') + '</button><div class="wk-t"><b>' + esc(tglRingkas(dates[0]) + ' – ' + tglRingkas(dates[5])) + '</b><small>' + (wk === senin(today) ? 'Pekan ini' : esc(mapelPekan.length ? mapelPekan.map(mapelName).join(', ') : 'Tidak ada mapel')) + '</small></div><button class="btn icon" data-wk="7" aria-label="Pekan berikutnya">' + icon('chevron-right') + '</button></div>' +
        '<div class="day-chips" role="tablist">' +
        days.map(t => '<button role="tab" data-tgl="' + t + '" class="' + (t === st.tgl ? 'on ' : '') + (t === today ? 'today' : '') + '" aria-selected="' + (t === st.tgl) + '">' + hariOf(t) + ' <small>' + Number(t.slice(8)) + '</small></button>').join('') +
      '</div><span class="grow"></span><span class="chip line">' + icon('clock', 'sm') + list.length + ' mapel • WIT</span></div>' +
      '<div class="card-body">' + (list.length ? '<div class="sessions">' + list.map((j, i) => sessionCard(j, i, false)).join('') + '</div>' :
        emptyState('calendar', 'Tidak ada pelajaran', 'Belum ada jadwal pada ' + fmt.tgl(st.tgl, { hari: true }) + ' untuk kelas ini.')) + '</div></div>' +
      '<div class="card mt-24"><div class="card-head"><div class="icon-tile">' + icon('calendar') + '</div><div class="grow"><h3>Mata pelajaran berjalan &amp; akan datang</h3><div class="sub">Setiap mapel dilaksanakan 6 hari</div></div></div><div class="card-body">' +
        (upcoming.length ? '<div class="sessions">' + upcoming.slice(0, 8).map(j => '<div class="session"><div class="grow"><div class="row" style="gap:8px"><span class="time">' + esc(rentangJadwal(j)) + '</span>' + (j.Tutup_Jumat === 'Ya' ? '<span class="badge draft">Penutupan Jumat</span>' : '') + '</div><h3 class="mt-8">' + esc(mapelName(j.ID_Mapel)) + '</h3><div class="muted small">' + esc(gadikName(j.ID_Gadik)) + ' • ' + esc(fmt.jam(j.Jam_Mulai)) + '–' + esc(fmt.jam(j.Jam_Selesai)) + ' WIT' + (j.Ruang ? ' • ' + esc(j.Ruang) : '') + '</div></div><button class="btn outline xs" data-goto-tgl="' + esc(j.Tanggal_Mulai < today ? today : j.Tanggal_Mulai) + '">Lihat</button></div>').join('') + '</div>'
          : '<p class="muted">Belum ada jadwal mapel yang akan datang.</p>') + '</div></div>';
    $$('[data-tgl]', el).forEach(b => { b.onclick = () => { st.tgl = b.dataset.tgl; render(); }; });
    $$('[data-wk]', el).forEach(b => { b.onclick = () => { st.tgl = addDays(wk, Number(b.dataset.wk)); render(); }; });
    $$('[data-goto-tgl]', el).forEach(b => { b.onclick = () => { st.tgl = b.dataset.gotoTgl; render(); }; });
    const ks = $('#jv-kelas', el);
    if (ks) ks.onchange = () => { st.kelas = ks.value; render(); };
  }
  return { show(root) { el = root; bindDokumen(root); render(); }, onBoot(root) { el = root; render(); } };
})();

page('jadwal', {
  title: 'Jadwal Pelajaran',
  show(el, param, o) { (S.role === 'Admin' && window.JadwalAdmin ? window.JadwalAdmin : JadwalView).show(el, param, o); },
  onBoot(el, param) { (S.role === 'Admin' && window.JadwalAdmin ? window.JadwalAdmin : JadwalView).onBoot(el, param); }
});

// ==========================================================================
// INPUT NILAI HARIAN — Gadik (US-10)
// Alur: pilih tanggal → pilih sesi yang diajar (radio-card) → isi nilai seluruh
// peserta (draf tersimpan otomatis) → "Selesai & Kirim ke Rekap" (nilai dikunci).
// ==========================================================================
/**
 * Lembar penilaian harian (format PROLAT): NO · NAMA · PANGKAT/NRP · A1 A2 A3 JUMLAH · B1 B2 JUMLAH · C1 C2 JUMLAH.
 * rows: [{ p: peserta, no, v: [7 butir] }]; opt.edit → kotak isian; opt.status(pid) → kolom status.
 */
function lembarTabel(rows, opt) {
  opt = opt || {};
  const A = PENILAIAN.ASPEK;
  let h1 = '<tr><th rowspan="2" class="no">NO</th><th rowspan="2" class="nm">NAMA</th><th rowspan="2" class="pn">PANGKAT / NRP</th>', h2 = '<tr>';
  A.forEach(g => {
    h1 += '<th colspan="' + g.butir.length + '" class="grp g0">' + esc(g.nama.toUpperCase()) + '</th><th rowspan="2" class="jml">JUMLAH</th>';
    g.butir.forEach((b, k) => { h2 += '<th class="bt' + (k === 0 ? ' g0' : '') + '">' + b + '</th>'; });
  });
  if (opt.status) h1 += '<th rowspan="2" class="st">STATUS</th>';
  const body = rows.map(r => {
    const pid = r.p.ID_Peserta, v = r.v || KOSONG(), sums = jumlahAspek(v), any = terisi(v) > 0, dirty = !!(opt.dirty && opt.dirty(pid));
    let h = '<tr data-pid="' + esc(pid) + '"><td class="no">' + pad2(r.no) + '</td><td class="nm"><b>' + esc(r.p.Nama_Lengkap) + '</b><small>' + esc(pelName(r.p.ID_Peleton)) + '</small></td><td class="pn">' + (r.p.Pangkat ? '<span class="pk">' + esc(r.p.Pangkat) + '</span>' : '') + '<span class="nr">' + esc(r.p.NRP || '') + '</span></td>';
    let i = 0;
    A.forEach((g, gi) => {
      g.butir.forEach((b, k) => {
        const x = v[i];
        h += '<td class="bt' + (k === 0 ? ' g0' : '') + '" data-label="' + b + '">' + (opt.edit
          ? '<input class="skor' + (dirty ? ' dirty' : '') + '" inputmode="decimal" autocomplete="off" maxlength="5" data-pid="' + esc(pid) + '" data-i="' + i + '" value="' + esc(fmtSkor(x)) + '" aria-label="' + esc(b + ' — ' + r.p.Nama_Lengkap) + '">'
          : '<span class="skv">' + (x === '' || x == null ? '<span class="miss">—</span>' : esc(fmtSkor(x))) + '</span>') + '</td>';
        i++;
      });
      h += '<td class="jml" data-label="Σ ' + esc(g.nama.replace('Aspek ', '')) + '"><b data-j="' + esc(pid + '|' + gi) + '">' + (any ? fmtSkor(sums[gi]) : '<span class="miss">—</span>') + '</b></td>';
    });
    if (opt.status) h += '<td class="st"><span data-st="' + esc(pid) + '">' + opt.status(pid) + '</span></td>';
    return h + '</tr>';
  }).join('');
  return '<table class="sheet' + (opt.edit ? ' edit' : '') + '"><thead>' + h1 + '</tr>' + h2 + '</tr></thead><tbody>' + body + '</tbody></table>';
}
function lembarLegend() {
  return '<div class="sheet-legend">' + icon('info', 'sm') + '<span>Skor tiap butir <b>0–' + PENILAIAN.SKOR_MAX + '</b>. <b>JUMLAH</b> terhitung otomatis (butir kosong = 0).</span>' +
    PENILAIAN.ASPEK.map(g => '<span class="chip line">' + esc(g.nama) + ' ' + g.butir.join('·') + ' • ' + Math.round(g.bobot * 100) + '%</span>').join('') + '</div>';
}

/** Data rekap format v1.2+ (sesi = daftar, nilai per sesi = butir A1–C2). */
function rekapValid(d) { return !!d && Array.isArray(d.sesi) && !!d.nilai && typeof d.nilai === 'object'; }

/** Data nilai harian format v1.2+ (cache dari versi lama diabaikan & diambil ulang). */
function harianValid(d) {
  if (!d || typeof d.sesi !== 'object' || typeof d.nilai !== 'object' || !d.sesi || !d.nilai) return false;
  return Object.keys(d.nilai).every(j => Object.keys(d.nilai[j] || {}).every(p => Array.isArray(d.nilai[j][p]) && Array.isArray(d.nilai[j][p][0])));
}

const NilaiPage = (() => {
  const st = { tgl: '', jid: '', pel: '', status: '', q: '' };
  const savers = {}, bad = {};
  let el, table = null, saver = null, loadErr = null, workFor = '', shown = [];

  const key = (t, j) => 'draft:nilai:' + t + ':' + j;
  const J = id => S.boot.jadwal.find(j => j.ID_Jadwal === id);
  const day = () => (S.data.harian || {})[st.tgl];
  const sesi = () => { const d = day(); return d && st.jid && d.sesi ? d.sesi[st.jid] || null : null; };
  const locked = () => { const s = sesi(); return !!(s && s.Status === 'Selesai'); };
  const savedOf = pid => { const d = day(), m = d && d.nilai && d.nilai[st.jid]; return m ? m[pid] || null : null; };
  const peserta = () => { const j = J(st.jid); return j ? S.boot.peserta.filter(p => p.ID_Kelas === j.ID_Kelas) : []; };

  /** Sesi yang diajar Gadik ini pada tanggal tsb (urut jam). Daftar server dipakai bila sudah dimuat. */
  const myJadwal = () => S.boot.jadwal.filter(j => j.ID_Gadik === S.me.ID_Gadik);
  /** Tanggal terjauh yang boleh diisi: hari ini, atau Sabtu besok bila penutupan dimajukan ke Jumat. */
  function maxTgl() { const t = todayStr(), b = addDays(t, 1); return myJadwal().some(j => bolehIsiAwal(j, b)) ? b : t; }
  function mySessions(tgl) {
    const d = (S.data.harian || {})[tgl], awal = tgl > todayStr();
    let list = myJadwal().filter(j => jadwalAktif(j, tgl) && (!awal || bolehIsiAwal(j, tgl)));
    if (d && d.jadwal) { const ok = new Set(d.jadwal); list = list.filter(j => ok.has(j.ID_Jadwal)); }
    return list.sort((a, b) => menit(a.Jam_Mulai) - menit(b.Jam_Mulai));
  }

  function build(root) {
    el = root;
    el.innerHTML =
      pageHead({
        eyebrow: 'Penilaian Harian // Tenaga Pendidik',
        title: 'Input Nilai Harian',
        desc: 'Pilih <b>tanggal</b> dan <b>sesi</b> yang Anda ajar, isi skor <b>A1–C2 (0–10)</b> seluruh peserta sesuai format penilaian PROLAT, lalu tekan <b>Selesai &amp; Kirim ke Rekap</b>. Nilai tersimpan otomatis sebagai draf — <span class="kbd">Enter</span> pindah ke butir berikutnya, <span class="kbd">↑</span><span class="kbd">↓</span> pindah peserta.',
        chips: '<span class="chip ink">' + icon('lock', 'sm') + 'Hanya sesi yang Anda ajar</span>'
      }) +
      '<div class="card"><div class="card-head">' +
        '<div class="step-no">1</div><div class="grow"><h3>Tanggal &amp; sesi</h3><div class="sub" id="nh-hari"></div></div>' +
        '<div class="nh-date"><button class="btn icon" id="nh-prev" type="button" aria-label="Hari sebelumnya" title="Hari sebelumnya">' + icon('chevron-left') + '</button>' +
          '<input type="date" id="nh-date" class="input mono" aria-label="Tanggal penilaian">' +
          '<button class="btn icon" id="nh-next" type="button" aria-label="Hari berikutnya" title="Hari berikutnya">' + icon('chevron-right') + '</button></div>' +
        '<div class="seg" id="nh-quick"><button type="button" data-quick="0">Hari ini</button><button type="button" data-quick="-1">Kemarin</button></div>' +
      '</div><div class="card-body"><div class="label-mono" style="margin-bottom:10px">Sesi yang Anda ajar</div><div id="nh-sesi"></div></div></div>' +
      '<div id="nh-draf"></div>' +
      '<div id="nh-work"></div>';

    $('#nh-date', el).addEventListener('change', e => { if (e.target.value) selectDate(e.target.value); else e.target.value = st.tgl; });
    $('#nh-prev', el).onclick = () => selectDate(addDays(st.tgl, -1));
    $('#nh-next', el).onclick = () => selectDate(addDays(st.tgl, 1));
    $('#nh-quick', el).onclick = e => { const b = e.target.closest('[data-quick]'); if (b) selectDate(addDays(todayStr(), Number(b.dataset.quick))); };
    const sh = $('#nh-sesi', el);
    sh.addEventListener('change', e => { if (e.target.name === 'nh-sesi') selectSesi(e.target.value); });
    sh.addEventListener('click', e => {
      const g = e.target.closest('[data-goto]'); if (g) return selectDate(g.dataset.goto);
      if (e.target.closest('[data-retry]')) load(true);
    });
    $('#nh-work', el).addEventListener('click', e => { const b = e.target.closest('[data-unduh]'); if (b) ekspor(b.dataset.unduh, b); });
    $('#nh-draf', el).addEventListener('click', e => {
      const b = e.target.closest('[data-open-sesi]');
      if (b) { const [t, j] = b.dataset.openSesi.split('/'); selectDate(t, j); scrollToWork(); }
    });
  }

  // ---------- pemilihan tanggal & sesi ----------
  function selectDate(tgl, jid) {
    if (!isTgl(tgl)) return;
    const today = todayStr(), mx = maxTgl();
    if (tgl > mx) {
      const sab = hariOf(tgl) === 'Sabtu' && tgl === addDays(today, 1);
      toast('Tanggal belum tiba', sab ? 'Nilai hari Sabtu baru dapat diisi hari Jumat bila penutupan dimajukan ke Jumat (diatur Admin di Jadwal).' : 'Nilai hanya dapat diisi untuk hari ini atau tanggal yang sudah lewat.', 'warning');
      tgl = mx;
    }
    flushCurrent();
    const sameDay = tgl === st.tgl;
    st.tgl = tgl;
    const list = mySessions(tgl);
    if (jid !== undefined) st.jid = list.some(j => j.ID_Jadwal === jid) ? jid : '';
    else if (!sameDay || !list.some(j => j.ID_Jadwal === st.jid)) st.jid = '';
    if (!st.jid && list.length === 1) st.jid = list[0].ID_Jadwal;
    afterSelect();
    load(false);
  }
  function selectSesi(jid) {
    if (jid === st.jid) return;
    const radioFocus = document.activeElement && document.activeElement.name === 'nh-sesi';
    flushCurrent();
    st.jid = jid;
    afterSelect();
    if (radioFocus) { const c = $('input[name="nh-sesi"]:checked', el); if (c) c.focus(); }
    scrollToWork();
  }
  function afterSelect() {
    if (workFor !== st.tgl + '|' + st.jid) { st.pel = ''; st.status = ''; st.q = ''; Object.keys(bad).forEach(k => { delete bad[k]; }); }
    syncHash(); useSaver(); renderSesi(); renderDraf(); ensureWork();
  }
  function flushCurrent() { if (saver && saver.count()) saver.flush(); }
  function scrollToWork() {
    const box = $('#nh-work', el);
    if (!box || !box.firstElementChild) return;
    setTimeout(() => { const r = box.getBoundingClientRect(); if (r.top > window.innerHeight * 0.55) box.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
  }
  function syncHash() {
    const param = st.tgl + (st.jid ? '/' + st.jid : '');
    const h = '#/nilai/' + st.tgl + (st.jid ? '/' + encodeURIComponent(st.jid) : '');
    if (S.current && S.current.name === 'nilai') { if (location.hash !== h) history.replaceState(null, '', h); S.current.param = param; }
  }

  // ---------- penyimpan otomatis per sesi (draf tahan muat ulang) ----------
  function useSaver() {
    if (!st.jid || locked()) { saver = null; return; }
    const k = key(st.tgl, st.jid);
    if (!savers[k]) savers[k] = makeSaver(st.tgl, st.jid);
    saver = savers[k];
  }
  function makeSaver(tgl, jid) {
    const here = () => st.tgl === tgl && st.jid === jid;
    return new AutoSaver({
      key: key(tgl, jid), delay: 1500,
      send: batch => api('nilaiSave', { tanggal: tgl, idJadwal: jid, items: Object.keys(batch).map(id => ({ id, v: batch[id] })) }),
      onState: id => { if (here() && el) updateRow(id); },
      onSaved: res => {
        const d = (S.data.harian || {})[tgl];
        if (d) {
          d.nilai = d.nilai || {}; d.sesi = d.sesi || {};
          const m = d.nilai[jid] = d.nilai[jid] || {};
          res.data.saved.forEach(s => { if (s.nilai === '') delete m[s.id]; else m[s.id] = [s.v, s.waktu, S.me.Nama_Lengkap]; });
          if (res.data.sesi) d.sesi[jid] = Object.assign({}, d.sesi[jid] || {}, res.data.sesi);
          cachePut('harian:' + tgl, d);
        }
        if (res.data.sesi) sesiStatUpdate(res.data.sesi);
        if (!el || st.tgl !== tgl) return;
        renderSesi(); renderDraf();
        if (here()) { renderHead(); updateProgress(); }
      },
      onFail: res => {
        if (res.code === 'OUTDATED') { toast('Muat ulang aplikasi', res.message, 'warning'); return; }
        if (res.code === 'LOCKED') {
          toast('Sesi sudah dikunci', res.message, 'warning');
          if (here()) load(true);
          return;
        }
        toast('Gagal menyimpan nilai', res.message + ' Draf tetap aman di perangkat ini.', 'error');
      }
    });
  }

  // ---------- tampilan: kartu sesi ----------
  function renderSesi() {
    const host = $('#nh-sesi', el), d = day(), list = mySessions(st.tgl), today = todayStr();
    const mx = maxTgl();
    $('#nh-hari', el).textContent = fmt.tgl(st.tgl, { hari: true }) + (st.tgl === today ? ' • hari ini' : st.tgl > today ? ' • diisi lebih awal (penutupan dimajukan ke Jumat)' : '');
    const date = $('#nh-date', el);
    date.max = mx;
    if (date.value !== st.tgl) date.value = st.tgl;
    $('#nh-next', el).disabled = st.tgl >= mx;
    const qk = $('#nh-quick', el);
    if (mx > today && !$('[data-quick="1"]', qk)) qk.insertAdjacentHTML('beforeend', '<button type="button" data-quick="1" title="Penutupan dimajukan ke Jumat">Sabtu</button>');
    if (mx <= today) { const b1 = $('[data-quick="1"]', qk); if (b1) b1.remove(); }
    $$('#nh-quick [data-quick]', el).forEach(b => b.classList.toggle('on', addDays(today, Number(b.dataset.quick)) === st.tgl));

    if (!list.length) {
      const mine = myJadwal(), cand = new Set();
      mine.forEach(j => {
        if (j.Tanggal_Mulai) tanggalJadwal(j).forEach(t => { if (t <= mx) cand.add(t); });
        else hariList(j).forEach(h => cand.add(lastDateOf(h, today)));
      });
      const pick = Array.from(cand).sort().reverse().slice(0, 6).reverse();
      const next = mine.filter(j => j.Tanggal_Mulai && j.Tanggal_Mulai > mx).sort((a, b) => a.Tanggal_Mulai.localeCompare(b.Tanggal_Mulai))[0];
      host.innerHTML = mine.length
        ? emptyState('calendar', 'Tidak ada mapel Anda pada ' + fmt.tgl(st.tgl, { hari: true }), (pick.length ? 'Pilih tanggal mengajar Anda:' : 'Belum ada tanggal mengajar yang sudah tiba.') + (next ? ' Jadwal berikutnya: ' + mapelName(next.ID_Mapel) + ', ' + rentangJadwal(next) + '.' : ''),
            pick.length ? '<div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap">' + pick.map(t => '<button type="button" class="btn outline sm" data-goto="' + t + '">' + esc(fmt.tgl(t, { hari: true, short: true })) + '</button>').join('') + '</div>' : '')
        : emptyState('calendar', 'Belum ada jadwal mengajar', 'Admin Satdik belum menjadwalkan Anda di kelas mana pun. Hubungi Admin Satdik.');
      return;
    }
    host.innerHTML = '<div class="radio-cards sesi-cards" role="radiogroup" aria-label="Sesi mengajar">' + list.map(j => {
      const on = j.ID_Jadwal === st.jid, s = d && d.sesi ? d.sesi[j.ID_Jadwal] : null, total = pesertaCount(j.ID_Kelas);
      const done = !!(s && s.Status === 'Selesai');
      const sv = savers[key(st.tgl, j.ID_Jadwal)];
      const pend = done ? 0 : sv ? sv.count() : Object.keys(Store.get(uk(key(st.tgl, j.ID_Jadwal)), null) || {}).length;
      return '<label class="radio-card sesi-card' + (on ? ' checked' : '') + (done ? ' done' : '') + '">' +
        '<input type="radio" name="nh-sesi" value="' + esc(j.ID_Jadwal) + '"' + (on ? ' checked' : '') + '>' +
        '<span class="sc-top"><span class="time">' + esc(fmt.jam(j.Jam_Mulai)) + '–' + esc(fmt.jam(j.Jam_Selesai)) + ' WIT</span>' +
          (d ? sesiBadge(s, total) : loadErr ? '<span class="badge bad">Gagal memuat</span>' : '<span class="badge empty">Memuat…</span>') + '</span>' +
        '<strong>' + esc(mapelName(j.ID_Mapel)) + (tanggalJadwal(j).indexOf(st.tgl) > -1 ? ' <span class="chip line">HARI ' + (tanggalJadwal(j).indexOf(st.tgl) + 1) + ' / ' + tanggalJadwal(j).length + '</span>' : '') + '</strong>' +
        '<span class="muted">' + esc(kelasName(j.ID_Kelas, true)) + ' • ' + total + ' peserta' + (j.Ruang ? ' • ' + esc(j.Ruang) : '') + '</span>' +
        (st.tgl > today ? '<span class="sc-pend">' + icon('info', 'sm') + 'Penutupan dimajukan ke Jumat — nilai Sabtu diisi hari ini</span>' : '') +
        (pend ? '<span class="sc-pend">' + icon('clock', 'sm') + pend + ' nilai belum terkirim dari perangkat ini</span>' : '') +
      '</label>';
    }).join('') + '</div>' +
      (loadErr && !d ? '<div class="alert red mt-16">' + icon('wifi-off') + '<div>Status sesi belum dapat dimuat: ' + esc(loadErr) + ' <button type="button" class="btn outline xs" data-retry>Coba lagi</button></div></div>' : '') +
      (st.jid ? '' : '<p class="hint mt-16">' + icon('info', 'sm') + ' Pilih salah satu sesi di atas untuk mulai mengisi nilai.</p>');
  }

  /** Pengingat sesi lain yang masih draf (belum dikirim ke rekap). */
  function renderDraf() {
    const box = $('#nh-draf', el), stt = S.boot.stat || {}, all = stt.sesiDraf || [];
    const list = all.filter(x => !(x.Tanggal === st.tgl && x.ID_Jadwal === st.jid) && J(x.ID_Jadwal));
    if (!list.length) { box.innerHTML = ''; return; }
    const n = Math.max(list.length, (stt.sesiDrafTotal || all.length) - (all.length - list.length));
    box.innerHTML = '<div class="notice mt-24"><div class="icon-tile">' + icon('clock') + '</div><div class="grow"><b>' + n + ' sesi lain masih draf — belum masuk rekap</b>' +
      '<p>Lengkapi lalu tekan <b>Selesai &amp; Kirim ke Rekap</b> agar nilainya dihitung.</p><div class="draf-list">' +
      list.slice(0, 6).map(x => '<button type="button" class="btn outline xs" data-open-sesi="' + esc(x.Tanggal + '/' + x.ID_Jadwal) + '">' + esc(fmt.tgl(x.Tanggal, { hari: true, short: true })) + ' • ' + esc(mapelName(x.ID_Mapel)) + ' (' + esc(kelasName(x.ID_Kelas)) + ')' + icon('arrow-right', 'sm') + '</button>').join('') +
      '</div></div></div>';
  }

  // ---------- tampilan: area pengisian nilai sesi terpilih ----------
  function ensureWork() {
    if (workFor !== st.tgl + '|' + st.jid || (st.jid && !$('#nh-table', el))) renderWork();
    else if (st.jid) { renderHead(); refreshTable(true); }
  }
  function renderWork() {
    const box = $('#nh-work', el), j = J(st.jid);
    workFor = st.tgl + '|' + st.jid;
    if (!st.jid || !j) { box.innerHTML = ''; table = null; return; }
    box.innerHTML =
      '<div class="card mt-24"><div class="card-head" id="nh-head"></div><div id="nh-note"></div>' +
        '<div class="toolbar">' +
          '<div class="field narrow"><label for="nh-pel">Peleton</label><select id="nh-pel" class="select">' + options(pelOf(j.ID_Kelas), 'ID_Peleton', p => p.Nama_Peleton, st.pel, 'Semua') + '</select></div>' +
          '<div class="field narrow"><label for="nh-status">Status</label><select id="nh-status" class="select"><option value="">Semua</option><option value="empty">Belum diisi</option><option value="part">Belum lengkap</option><option value="full">Lengkap</option><option value="draft">Draf / gagal</option></select></div>' +
          '<div class="field search"><label for="nh-q">Cari</label><div class="input-wrap">' + icon('search', 'lead') + '<input id="nh-q" class="input with-lead" placeholder="Nama atau NRP…" autocomplete="off" value="' + esc(st.q) + '"></div></div>' +
          tombolUnduh() +
        '</div>' + lembarLegend() +
        '<div class="sheet-wrap" id="nh-sheet"></div></div>' +
      '<div class="sticky-bar" id="nh-bar"></div>';
    $('#nh-status', el).value = st.status;
    table = true;
    const host = $('#nh-sheet', el);
    host.addEventListener('input', e => { if (e.target.matches('.skor')) onInput(e.target); });
    host.addEventListener('focusin', e => { if (e.target.matches && e.target.matches('.skor') && e.target.select) e.target.select(); });
    host.addEventListener('keydown', e => {
      if (!e.target.matches('.skor') || ['Enter', 'ArrowDown', 'ArrowUp'].indexOf(e.key) === -1) return;
      e.preventDefault();
      const pid = e.target.dataset.pid, i = Number(e.target.dataset.i), r = shown.indexOf(pid);
      let np = pid, ni = i;
      if (e.key === 'Enter') { if (i < BUTIR.length - 1) ni = i + 1; else { np = shown[r + 1]; ni = 0; } }
      else np = shown[r + (e.key === 'ArrowUp' ? -1 : 1)];
      if (!np) { if (e.key === 'Enter') { const b = $('#nh-done', el); if (b) b.focus(); } return; }
      const n = host.querySelector('.skor[data-pid="' + CSS.escape(np) + '"][data-i="' + ni + '"]');
      if (n) { n.focus(); n.select(); }
    });
    host.addEventListener('click', e => { if (e.target.closest('[data-retry]')) load(true); });
    $('#nh-pel', el).onchange = e => { st.pel = e.target.value; refreshTable(); };
    $('#nh-status', el).onchange = e => { st.status = e.target.value; refreshTable(); };
    $('#nh-q', el).addEventListener('input', debounce(e => { st.q = e.target.value; refreshTable(); }, 250));
    $('#nh-bar', el).addEventListener('click', e => {
      const b = e.target.closest('button[id]');
      if (!b) return;
      if (b.id === 'nh-save') manualSave();
      else if (b.id === 'nh-done') finish();
      else if (b.id === 'nh-reload') load(true);
    });
    renderHead();
    refreshTable();
  }

  function renderHead() {
    const j = J(st.jid), head = $('#nh-head', el);
    if (!j || !head) return;
    const d = day(), s = sesi(), lk = locked(), total = pesertaCount(j.ID_Kelas);
    head.innerHTML = '<div class="step-no">2</div><div class="grow"><h3>' + esc(mapelName(j.ID_Mapel)) + ' — ' + esc(kelasName(j.ID_Kelas)) + '</h3>' +
      '<div class="sub">' + esc(fmt.tgl(st.tgl, { hari: true })) + ' • ' + esc(fmt.jam(j.Jam_Mulai)) + '–' + esc(fmt.jam(j.Jam_Selesai)) + ' WIT' + (j.Ruang ? ' • ' + esc(j.Ruang) : '') + ' • ' + total + ' peserta</div></div>' +
      (!d ? '' : lk ? '<span class="badge ok">' + icon('lock', 'sm') + ' Terkunci • masuk rekap</span>' : s ? '<span class="badge draft">Draf • belum masuk rekap</span>' : '<span class="badge empty">Belum diisi</span>');
    $('#nh-note', el).innerHTML = lk
      ? '<div class="card-body" style="padding-bottom:0"><div class="alert green">' + icon('check-circle') + '<div><b>Nilai sesi ini sudah dikirim ke rekap</b>' + (s.Waktu_Selesai ? ' pada ' + esc(fmt.dateTime(s.Waktu_Selesai)) : '') + (s.Diselesaikan_Oleh ? ' oleh ' + esc(s.Diselesaikan_Oleh) : '') + '. Nilai dikunci — untuk koreksi, minta Admin Satdik membuka kunci sesi ini.</div></div></div>'
      : s && s.Catatan_Admin
        ? '<div class="card-body" style="padding-bottom:0"><div class="alert gold">' + icon('unlock') + '<div><b>Dibuka kembali oleh Admin Satdik</b> — ' + esc(s.Catatan_Admin) + '. Perbaiki nilai lalu tekan <b>Selesai &amp; Kirim ke Rekap</b> lagi.</div></div></div>'
        : '';
    const bar = $('#nh-bar', el);
    bar.innerHTML = '<div class="prog"><div class="row between"><b>Peserta dinilai lengkap</b><span class="mono" id="nh-prog-t">0/0</span></div><div class="progress"><span id="nh-prog" style="width:0"></span></div></div>' +
      (lk
        ? '<span class="small muted">' + icon('lock', 'sm') + ' Nilai terkunci dan sudah dihitung di rekap</span><button type="button" class="btn outline" id="nh-reload">' + icon('refresh') + 'Periksa ulang</button>'
        : '<span class="small muted" id="nh-save-state"></span><button type="button" class="btn outline" id="nh-save"' + (d ? '' : ' disabled') + '>' + icon('save') + 'Simpan Draf</button>' +
          '<button type="button" class="btn primary" id="nh-done"' + (d ? '' : ' disabled') + '>' + icon('send') + 'Selesai &amp; Kirim ke Rekap</button>');
    updateProgress();
  }

  /** 7 butir peserta: draf yang belum terkirim, atau yang tersimpan di server. */
  function valueOf(pid) {
    if (saver && saver.has(pid)) return saver.get(pid);
    const s = savedOf(pid);
    return s ? s[0] : KOSONG();
  }
  function hasBad(pid) { return Object.keys(bad).some(k => k.indexOf(pid + '|') === 0); }
  function statusKey(pid) {
    const s = saver ? saver.state(pid) : '';
    if (s) return s;
    if (hasBad(pid)) return 'invalid';
    const n = terisi(valueOf(pid));
    return n === 0 ? 'empty' : n < BUTIR.length ? 'part' : 'full';
  }
  function statusHtml(pid) {
    const n = terisi(valueOf(pid));
    if (locked()) return n ? '<span class="badge ok">Masuk rekap</span>' : '<span class="badge off">Tidak dinilai</span>';
    const k = statusKey(pid);
    if (k === 'invalid') return '<span class="badge bad">Harus 0–' + PENILAIAN.SKOR_MAX + '</span>';
    if (k === 'saving' || k === 'draft' || k === 'error') return saveBadge(k, 0, saver && saver.errors[pid]);
    if (k === 'empty') return '<span class="badge empty">Belum diisi</span>';
    if (k === 'part') return '<span class="badge part">Sebagian ' + n + '/' + BUTIR.length + '</span>';
    return '<span class="badge ok">Lengkap</span>';
  }

  function onInput(input) {
    if (!saver) return;
    const pid = input.dataset.pid, i = Number(input.dataset.i), p = parseSkor(input.value), k = pid + '|' + i;
    const cur = valueOf(pid).slice(), sv = savedOf(pid), base = sv ? sv[0] : KOSONG();
    input.classList.toggle('invalid', !!p.error);
    // Isian tidak valid: butir itu kembali ke nilai tersimpan (angka setengah-ketik seperti "1" dari "12" tidak ikut terkirim)
    if (p.error) { bad[k] = 1; cur[i] = base[i]; } else { delete bad[k]; cur[i] = p.empty ? '' : p.value; }
    if (JSON.stringify(cur) === JSON.stringify(base)) saver.unset(pid); else saver.set(pid, cur);
    if (p.error) { updateRow(pid); updateProgress(); return; }
    input.classList.toggle('dirty', saver.has(pid));
    updateRow(pid);
    updateProgress();
  }

  function updateRow(pid) {
    const v = valueOf(pid), sums = jumlahAspek(v), any = terisi(v) > 0, dirty = !!(saver && saver.has(pid));
    PENILAIAN.ASPEK.forEach((g, gi) => {
      const b = el.querySelector('[data-j="' + CSS.escape(pid + '|' + gi) + '"]');
      if (b) b.innerHTML = any ? fmtSkor(sums[gi]) : '<span class="miss">—</span>';
    });
    const sEl = el.querySelector('[data-st="' + CSS.escape(pid) + '"]');
    if (sEl) sEl.innerHTML = statusHtml(pid);
    $$('.skor[data-pid="' + CSS.escape(pid) + '"]', el).forEach(inp => {
      inp.classList.toggle('dirty', dirty);
      const i = Number(inp.dataset.i);
      if (!dirty && document.activeElement !== inp && !bad[pid + '|' + i]) { inp.value = fmtSkor(v[i]); inp.classList.remove('invalid'); }
    });
    updateSaveState();
  }
  function updateSaveState() {
    const box = $('#nh-save-state', el);
    if (!box) return;
    const n = saver ? saver.count() : 0, err = saver ? Object.keys(saver.errors).length : 0, inv = Object.keys(bad).length;
    box.innerHTML = err ? '<span style="color:var(--red)">' + icon('alert-circle', 'sm') + ' ' + err + ' baris gagal disimpan</span>' :
      inv ? '<span style="color:var(--red)">' + icon('alert-circle', 'sm') + ' ' + inv + ' isian bukan 0–' + PENILAIAN.SKOR_MAX + '</span>' :
      n ? icon('clock', 'sm') + ' ' + n + ' baris menunggu disimpan' : icon('check-circle', 'sm') + ' Draf tersimpan';
  }
  function updateProgress() {
    const all = peserta();
    let full = 0, part = 0;
    all.forEach(p => { const n = terisi(valueOf(p.ID_Peserta)); if (n === BUTIR.length) full++; else if (n) part++; });
    const t = $('#nh-prog-t', el), b = $('#nh-prog', el);
    if (t) t.textContent = full + '/' + all.length + (part ? ' • ' + part + ' sebagian' : '');
    if (b) b.style.width = (all.length ? full / all.length * 100 : 0) + '%';
    updateSaveState();
  }

  function rows(all) {
    const q = norm(st.q);
    return all.filter(p => {
      if (st.pel && p.ID_Peleton !== st.pel) return false;
      if (q && norm(p.Nama_Lengkap).indexOf(q) === -1 && String(p.NRP).indexOf(q) === -1) return false;
      if (st.status) {
        const k = statusKey(p.ID_Peserta);
        if (st.status === 'draft') return ['draft', 'error', 'saving', 'invalid'].indexOf(k) > -1;
        return k === st.status;
      }
      return true;
    });
  }
  /** Gambar ulang lembar. Peserta selalu urut ABJAD; nomor mengikuti urutan lengkap kelas. */
  function refreshTable() {
    const host = $('#nh-sheet', el);
    if (!host || !table) return;
    if (!day()) { host.innerHTML = loadErr ? errorState(loadErr) : skeletonRows(6, 8); updateProgress(); return; }
    const all = urutNama(peserta()), noOf = {};
    all.forEach((p, i) => { noOf[p.ID_Peserta] = i + 1; });
    const list = rows(all);
    shown = list.map(p => p.ID_Peserta);
    if (!all.length) host.innerHTML = emptyState('users', 'Belum ada peserta', 'Belum ada peserta di kelas ini. Tambahkan lewat menu Peserta Pelatihan.', '<a class="btn primary" href="#/peserta">Buka Peserta Pelatihan</a>');
    else if (!list.length) host.innerHTML = emptyState('search', 'Tidak ada peserta', 'Tidak ada peserta yang cocok dengan filter.');
    else host.innerHTML = lembarTabel(list.map(p => ({ p, no: noOf[p.ID_Peserta], v: valueOf(p.ID_Peserta) })), { edit: !locked(), status: statusHtml, dirty: pid => !!(saver && saver.has(pid)) });
    updateProgress();
  }

  /** Unduh lembar sesi ini (format HARI pada berkas Excel PROLAT). */
  function ekspor(kind, btn) {
    const j = J(st.jid);
    if (!j || !day()) return;
    const all = urutNama(peserta());
    const data = {
      judul: 'PENILAIAN HARIAN PESERTA PELATIHAN', instansi: String(CFG.INSTANSI || 'SPN Polda Papua Barat').toUpperCase(),
      ringkas: kelasName(j.ID_Kelas) + ' • ' + mapelName(j.ID_Mapel) + ' • ' + fmt.tgl(st.tgl),
      info: [['Kelas', kelasName(j.ID_Kelas, true)], ['Mata Pelajaran', mapelName(j.ID_Mapel)],
        ['Hari / Tanggal', tglPanjang(st.tgl, true) + (tanggalJadwal(j).indexOf(st.tgl) > -1 ? ' (HARI ' + (tanggalJadwal(j).indexOf(st.tgl) + 1) + ')' : '') + ' • ' + fmt.jam(j.Jam_Mulai) + '–' + fmt.jam(j.Jam_Selesai) + ' WIT'],
        ['Gadik', gadikName(j.ID_Gadik)], ['Status', locked() ? 'Selesai — sudah masuk rekap' : 'Draf — belum dikirim ke rekap']],
      format: PENILAIAN, sheet: tanggalJadwal(j).indexOf(st.tgl) > -1 ? 'HARI ' + (tanggalJadwal(j).indexOf(st.tgl) + 1) : 'PENILAIAN HARIAN',
      ttd: ttdGadik(j.ID_Gadik, st.tgl),
      peserta: all.map(p => ({ nama: p.Nama_Lengkap, pn: pangkatNrp(p) })), nilai: all.map(p => valueOf(p.ID_Peserta))
    };
    unduhBerkas(kind === 'pdf' ? 'hariPdf' : 'hariXlsx', data, namaBerkas(['Penilaian-Harian', kelasName(j.ID_Kelas), mapelName(j.ID_Mapel), st.tgl], kind === 'pdf' ? 'pdf' : 'xlsx'), btn);
  }

  // ---------- aksi ----------
  async function manualSave() {
    if (!saver || !saver.count()) return toast('Tidak ada perubahan', 'Semua nilai sudah tersimpan sebagai draf.', 'info');
    await saver.flush();
    if (saver && !saver.count()) toast('Draf tersimpan', 'Tekan “Selesai & Kirim ke Rekap” bila nilai sesi ini sudah lengkap.');
  }

  async function finish() {
    const j = J(st.jid);
    if (!j || locked() || !day()) return;
    const inv = Object.keys(bad);
    if (inv.length) {
      toast('Periksa nilai', inv.length + ' isian bukan angka 0–' + PENILAIAN.SKOR_MAX + '. Perbaiki dulu sebelum mengirim.', 'error');
      const [pid, i] = inv[0].split('|'), f = el.querySelector('.skor[data-pid="' + CSS.escape(pid) + '"][data-i="' + i + '"]');
      if (f) f.focus();
      return;
    }
    if (saver && saver.count()) {
      const done = busy($('#nh-done', el), 'Menyimpan draf…');
      await saver.flush();
      done();
      if (saver && saver.count()) { toast('Belum bisa dikirim', 'Sebagian nilai gagal disimpan. Periksa koneksi lalu coba lagi.', 'error'); return; }
    }
    if (locked()) return;
    const all = peserta(), counts = all.map(p => terisi((savedOf(p.ID_Peserta) || [KOSONG()])[0]));
    const filled = counts.filter(n => n > 0).length, full = counts.filter(n => n === BUTIR.length).length, part = filled - full, empty = all.length - filled;
    if (!filled) { toast('Belum ada nilai', 'Isi minimal satu peserta sebelum mengirim ke rekap.', 'warning'); const f = $('.skor', el); if (f) f.focus(); return; }
    const ok = await confirmBox({
      title: 'Selesai & kirim ke rekap?', icon: 'send', okText: 'Ya, kirim ke rekap',
      html: '<b>' + full + ' dari ' + all.length + ' peserta</b> sudah dinilai lengkap (' + BUTIR.length + ' butir) untuk <b>' + esc(mapelName(j.ID_Mapel)) + '</b> — ' + esc(kelasName(j.ID_Kelas)) + ', ' + esc(fmt.tgl(st.tgl, { hari: true })) + '.' +
        (part ? '<br><br><span style="color:#9A6700"><b>' + part + ' peserta baru diisi sebagian</b> — butir yang kosong dihitung 0.</span>' : '') +
        (empty ? '<br><br><span style="color:var(--red)"><b>' + empty + ' peserta belum diisi</b> — dihitung 0 pada hari ini (sesuai rumus penilaian).</span>' : '') +
        '<br><br>Setelah dikirim, nilai sesi ini <b>dikunci</b>. Koreksi hanya dapat dilakukan setelah Admin Satdik membuka kunci.'
    });
    if (!ok) return;
    const tgl = st.tgl, jid = st.jid, done = busy($('#nh-done', el), 'Mengirim…');
    const res = await api('nilaiSelesai', { tanggal: tgl, idJadwal: jid });
    done();
    if (!res.success) {
      if (res.code === 'EMPTY') { toast('Belum ada nilai', res.message, 'warning'); load(true); return; }
      toast('Gagal mengirim ke rekap', res.message, 'error');
      return;
    }
    const d = (S.data.harian || {})[tgl];
    if (d) { d.sesi = d.sesi || {}; d.sesi[jid] = res.data.sesi; cachePut('harian:' + tgl, d); }
    sesiStatUpdate(res.data.sesi);
    toast('Nilai terkirim ke rekap', mapelName(j.ID_Mapel) + ' • ' + kelasName(j.ID_Kelas) + ' • ' + res.data.sesi.Jumlah + ' peserta. Nilai sesi ini kini terkunci.');
    if (st.tgl === tgl && st.jid === jid) { useSaver(); renderSesi(); renderDraf(); renderHead(); refreshTable(true); }
  }

  function load(force) {
    loadErr = null;
    const tgl = st.tgl;
    if (!tgl) return;
    S.data.harian = S.data.harian || {};
    swr('harian:' + tgl, 'nilaiHarian', { tanggal: tgl }, (d, fromCache) => {
      S.data.harian[tgl] = d;
      if (!fromCache) Object.keys(d.sesi || {}).forEach(j => sesiStatUpdate(d.sesi[j]));   // selaraskan pengingat draf di dashboard
      if (!el || st.tgl !== tgl) return;
      const list = mySessions(tgl);
      if (st.jid && !list.some(j => j.ID_Jadwal === st.jid)) st.jid = '';
      if (!st.jid && list.length === 1) st.jid = list[0].ID_Jadwal;
      syncHash(); useSaver(); renderSesi(); renderDraf();
      const a = document.activeElement, typing = el.contains(a) && a.matches('.skor') && !locked();
      if (workFor !== tgl + '|' + st.jid) renderWork();
      else if (typing) { shown.forEach(updateRow); renderHead(); }
      else if (st.jid) { renderHead(); refreshTable(true); }
    }, {
      fresh: force ? 0 : 20000, force, valid: harianValid,
      onError: res => { loadErr = res.message; if (el && st.tgl === tgl) { renderSesi(); refreshTable(); } }
    });
    if (!day()) { renderSesi(); refreshTable(); }
  }

  return {
    title: 'Input Nilai Harian',
    roles: ['Gadik'],
    show(root, param, o) {
      if (o.isNew || !el) build(root);
      const parts = String(param || '').split('/');
      if (isTgl(parts[0])) selectDate(parts[0], parts[1] || undefined);
      else selectDate(st.tgl || todayStr(), st.jid || undefined);
    },
    onBoot() {
      if (!el) return;
      renderSesi(); renderDraf();
      const a = document.activeElement;
      if (el.contains(a) && a.matches('.skor')) return;
      useSaver(); ensureWork();
    },
    leave() { Object.keys(savers).forEach(k => { if (savers[k].count()) savers[k].flush(); }); }
  };
})();
page('nilai', NilaiPage);

// ==========================================================================
// REKAP AKHIR — Admin & Gadik (lembar NIL AKHIR sesuai berkas PROLAT)
// ==========================================================================
function rumusAkhir() {
  return PENILAIAN.ASPEK.map(g => g.nama.replace('Aspek ', '') + ' ' + Math.round(g.bobot * 100) + '%').join(' + ');
}
const RekapAkhirPage = (() => {
  const st = { kelas: '', pel: '', q: '', urut: 'abjad', mapel: null };   // mapel null = pilih otomatis (mapel terbaru)
  let el, err = null, table = null, hasil = null;
  const data = k => (S.data.rekap || {})[k];
  /** Mapel yang punya penilaian terkirim, terbaru dulu. */
  function mapelAda(d) {
    const last = {};
    (d ? d.sesi : []).filter(x => x.Status === 'Selesai').forEach(x => { if (!last[x.ID_Mapel] || x.Tanggal > last[x.ID_Mapel]) last[x.ID_Mapel] = x.Tanggal; });
    return Object.keys(last).sort((a, b) => last[b].localeCompare(last[a]));
  }
  /** Data rekap tersaring per mata pelajaran (1 mapel = 6 hari, sesuai berkas PROLAT). */
  function dataMapel(d) {
    if (!d) return d;
    const ada = mapelAda(d);
    if (st.mapel === null || (st.mapel && ada.indexOf(st.mapel) === -1)) st.mapel = ada.length ? ada[0] : '';
    return st.mapel ? Object.assign({}, d, { sesi: d.sesi.filter(x => x.ID_Mapel === st.mapel) }) : d;
  }

  function load(k, force) {
    S.data.rekap = S.data.rekap || {};
    err = null;
    swr('rekap:' + k, 'rekap', { idKelas: k }, d => {
      S.data.rekap[k] = d;
      if (el && !el.hidden && st.kelas === k && !_modals.length) fill();
    }, { valid: rekapValid, fresh: force ? 0 : 5000, force, onError: res => { err = res.message; if (st.kelas === k) fill(); } });
  }

  function renderList() {
    const kel = kelasList();
    el.innerHTML = pageHead({
      eyebrow: 'Rekapitulasi // Nilai Akhir PROLAT',
      title: 'Rekap Akhir',
      desc: 'Pilih kelas untuk melihat <b>NIL AKHIR</b> dan <b>peringkat</b> peserta. Dihitung dari seluruh penilaian harian yang sudah dikirim Gadik ke rekap: ' + esc(rumusAkhir()) + '.'
    }) + (kel.length
      ? '<div class="grid c3">' + kel.map(kelasCard).join('') + '</div>'
      : emptyState('building', 'Belum ada kelas', S.role === 'Admin' ? 'Tambahkan angkatan & kelas di Master Data.' : 'Akun Anda belum ditugaskan ke kelas. Hubungi Admin Satdik.'));
  }
  function kelasCard(k) {
    const d = data(k.ID_Kelas) || cacheGet('rekap:' + k.ID_Kelas);
    const n = d && Array.isArray(d.sesi) ? hariPenilaian(d.sesi).length : null, draf = d && Array.isArray(d.sesi) ? d.sesi.filter(s => s.Status !== 'Selesai').length : 0;
    return '<a class="shortcut kelas-card" href="#/rekap-akhir/' + encodeURIComponent(k.ID_Kelas) + '">' +
      '<div class="row between"><div class="icon-tile">' + icon('medal') + '</div>' + (isAktif(k.Status) ? '' : '<span class="badge off">Nonaktif</span>') + '</div>' +
      '<h3>' + esc(k.Nama_Kelas) + '</h3><p>' + esc(k.Nama_Angkatan) + '</p>' +
      '<div class="kc-meta"><span>' + icon('users', 'sm') + pesertaCount(k.ID_Kelas) + ' peserta</span>' +
        (n == null ? '' : '<span>' + icon('calendar', 'sm') + n + ' hari dinilai</span>') + (draf ? '<span class="draf">' + draf + ' sesi draf</span>' : '') + '</div>' +
      '<span class="go">Lihat nilai akhir' + icon('arrow-right', 'sm') + '</span></a>';
  }

  function renderDetail() {
    const kl = R().kelas[st.kelas];
    if (!kl) {
      el.innerHTML = pageHead({ eyebrow: 'Rekapitulasi // Nilai Akhir', title: 'Rekap Akhir' }) +
        emptyState('building', 'Kelas tidak ditemukan', 'Kelas ini tidak ada atau bukan kelas penugasan Anda.', '<a class="btn primary" href="#/rekap-akhir">Pilih kelas</a>');
      table = null;
      return;
    }
    el.innerHTML = pageHead({
      eyebrow: 'Rekap Akhir // ' + kl.Nama_Angkatan,
      title: 'Nilai Akhir — ' + kl.Nama_Kelas,
      desc: 'NIL AKHIR = ' + esc(rumusAkhir()) + '. Nilai aspek = jumlah aspek seluruh hari ÷ jumlah hari ÷ banyak butir × 10. Klik baris untuk rincian per hari.',
      actions: '<a class="btn outline" href="#/rekap-akhir">' + icon('arrow-left') + 'Semua kelas</a><button class="btn outline" id="ra-refresh">' + icon('refresh') + 'Segarkan</button>'
    }) +
      '<div class="grid c4 keep2" id="ra-stats"></div><div id="ra-note"></div>' +
      '<div class="card mt-24"><div class="toolbar">' +
        '<div class="field"><label for="ra-mapel">Mata pelajaran</label><select id="ra-mapel" class="select"></select></div>' +
        '<div class="field narrow"><label for="ra-pel">Peleton</label><select id="ra-pel" class="select">' + options(pelOf(st.kelas), 'ID_Peleton', p => p.Nama_Peleton, st.pel, 'Semua') + '</select></div>' +
        '<div class="field search"><label for="ra-q">Cari peserta</label><div class="input-wrap">' + icon('search', 'lead') + '<input id="ra-q" class="input with-lead" placeholder="Nama atau NRP…" autocomplete="off" value="' + esc(st.q) + '"></div></div>' +
        '<div class="field narrow"><label>Urutkan</label><div class="seg" id="ra-urut"><button type="button" data-urut="abjad">Abjad</button><button type="button" data-urut="rank">Peringkat</button></div></div>' +
        tombolUnduh() +
      '</div><div id="ra-table"></div></div>';
    $('#ra-refresh', el).onclick = () => load(st.kelas, true);
    $('#ra-pel', el).onchange = e => { st.pel = e.target.value; fill(); };
    $('#ra-mapel', el).onchange = e => { st.mapel = e.target.value; fill(); };
    $('#ra-q', el).addEventListener('input', debounce(e => { st.q = e.target.value; fill(); }, 250));
    $('#ra-urut', el).onclick = e => { const b = e.target.closest('[data-urut]'); if (b) { st.urut = b.dataset.urut; table.sort = { key: st.urut === 'rank' ? 'rank' : 'no', dir: 'asc' }; fill(); } };
    el.querySelector('.card').addEventListener('click', e => { const b = e.target.closest('[data-unduh]'); if (b) ekspor(b.dataset.unduh, b); });
    const A = PENILAIAN.ASPEK;
    table = new Table($('#ra-table', el), {
      key: 'ID_Peserta', unit: 'peserta', pageSize: 50, sizes: [25, 50, 100], cls: 'rekap akhir', sort: { key: st.urut === 'rank' ? 'rank' : 'no', dir: 'asc' },
      columns: [
        { key: 'no', label: 'No', cls: 'no', sort: r => r.no, render: r => pad2(r.no) },
        { key: 'Nama', label: 'Nama', cls: 'card-title sticky', thCls: 'sticky', render: r => '<div class="t-name"><b>' + esc(r.Nama) + '</b><small>' + esc(pelName(r.p.ID_Peleton)) + '</small></div>' },
        { key: 'pn', label: 'Pangkat / NRP', sort: r => String(r.p.NRP), render: r => '<span class="mono small nowrap">' + esc(pangkatNrp(r.p)) + '</span>' }
      ].concat(A.map((g, gi) => ({
        key: 'a' + gi, label: 'Jumlah ' + g.nama, labelHtml: 'JUMLAH<span class="full">' + esc(g.nama) + '</span>', num: true,
        sort: r => (r.asp[gi] == null ? '' : r.asp[gi]), render: r => (r.asp[gi] == null ? '<span class="miss">—</span>' : fmt.num(r.asp[gi], 2))
      }))).concat([
        { key: 'na', label: 'Nil Akhir', labelHtml: 'NIL AKHIR', num: true, cls: 'avg', thCls: 'avg', sort: r => (r.na == null ? '' : r.na), render: r => (r.na == null ? '<span class="miss">—</span>' : '<b>' + fmt.num(r.na, 2) + '</b>') },
        { key: 'rank', label: 'Rank', num: true, sort: r => (r.rank == null ? '' : r.rank), render: r => (r.rank == null ? '<span class="miss">—</span>' : '<span class="rank' + (r.rank <= 3 ? ' top' : '') + '">' + r.rank + '</span>') }
      ]),
      onRow: id => detail(hasil.rows.find(r => r.ID_Peserta === id)),
      empty: () => emptyState('users', 'Tidak ada peserta', st.q || st.pel ? 'Tidak ada peserta yang cocok dengan filter.' : 'Belum ada peserta di kelas ini.')
    });
    $('#ra-table', el).addEventListener('click', e => { if (e.target.closest('[data-retry]')) load(st.kelas, true); });
    fill();
  }

  function fill() {
    if (!el || !table) return;
    $$('#ra-urut [data-urut]', el).forEach(b => b.classList.toggle('on', b.dataset.urut === st.urut));
    const d0 = data(st.kelas);
    if (!d0) { $('#ra-table', el).innerHTML = err ? errorState(err) : skeletonRows(8, 7); $('#ra-stats', el).innerHTML = ''; $('#ra-note', el).innerHTML = ''; return; }
    const d = dataMapel(d0), ada = mapelAda(d0);
    $('#ra-mapel', el).innerHTML = ada.map(m => '<option value="' + esc(m) + '"' + (m === st.mapel ? ' selected' : '') + '>' + esc(mapelName(m)) + '</option>').join('') +
      (ada.length > 1 ? '<option value=""' + (st.mapel === '' ? ' selected' : '') + '>Semua mata pelajaran (gabungan)</option>' : '') + (ada.length ? '' : '<option value="">Belum ada</option>');
    $('#ra-mapel', el).disabled = ada.length < 2;
    hasil = rekapAkhir(d, S.boot.peserta.filter(p => p.ID_Kelas === st.kelas));
    const vals = hasil.rows.map(r => r.na).filter(v => v != null), top = hasil.rows.find(r => r.rank === 1);
    const draf = d.sesi.filter(s => s.Status !== 'Selesai').length;
    const first = hasil.n ? hasil.units[0].s.Tanggal : '', last = hasil.n ? hasil.units[hasil.n - 1].s.Tanggal : '';
    $('#ra-stats', el).innerHTML =
      stat({ label: 'Hari Dinilai', value: hasil.n, unit: 'hari', icon: 'calendar', cap: hasil.n ? esc(fmt.tgl(first, { short: true }) + (first !== last ? ' – ' + fmt.tgl(last) : ' ' + first.slice(0, 4))) : 'Belum ada penilaian dikirim' }) +
      stat({ label: 'Rata-rata Nil Akhir', value: vals.length ? fmt.num(avg(vals), 2) : '—', unit: vals.length ? '/ 100' : '', icon: 'medal', cap: hasil.rows.length + ' peserta' }) +
      stat({ label: 'Peringkat 1', value: top ? fmt.num(top.na, 2) : '—', icon: 'shield-star', cap: top ? esc(top.Nama) : '—' }) +
      stat({ label: 'Sesi Draf', value: draf, unit: 'sesi', icon: 'clock', tone: draf ? 'red' : '', cap: draf ? 'Belum dikirim Gadik — belum dihitung' : 'Semua sesi sudah dihitung' });
    $('#ra-note', el).innerHTML = !hasil.n
      ? '<div class="notice mt-24"><div class="icon-tile">' + icon('info') + '</div><div><b>Belum ada penilaian harian yang masuk rekap</b><p>Nilai akhir muncul setelah Gadik menekan <b>Selesai &amp; Kirim ke Rekap</b> pada penilaian harian kelas ini.</p></div></div>'
      : draf ? '<div class="notice mt-24"><div class="icon-tile">' + icon('clock') + '</div><div><b>' + draf + ' sesi masih draf</b><p>Nilai sesi draf belum dihitung. Nilai akhir di bawah memakai ' + hasil.n + ' hari yang sudah dikirim.</p></div></div>' : '';
    const q = norm(st.q);
    table.sort = { key: st.urut === 'rank' ? 'rank' : 'no', dir: 'asc' };
    table.set(hasil.rows.filter(r => (!st.pel || r.p.ID_Peleton === st.pel) && (!q || norm(r.Nama).indexOf(q) > -1 || String(r.p.NRP).indexOf(q) > -1)), true);
  }

  function detail(r) {
    if (!r) return;
    const A = PENILAIAN.ASPEK;
    openModal({
      drawer: true, title: r.Nama, sub: pangkatNrp(r.p) + ' • ' + pelName(r.p.ID_Peleton) + ' • ' + kelasName(st.kelas), icon: 'user',
      body: '<div class="grid c2"><div class="stat"><div class="label-mono">Nil Akhir</div><div class="big">' + (r.na == null ? '—' : fmt.num(r.na, 2)) + '</div></div>' +
        '<div class="stat"><div class="label-mono">Peringkat</div><div class="big">' + (r.rank == null ? '—' : r.rank) + '<small>dari ' + hasil.rows.length + '</small></div></div></div>' +
        '<ul class="list-clean">' + A.map((g, gi) => '<li><div class="grow"><b>' + esc(g.nama) + '</b><div class="small muted">Bobot ' + Math.round(g.bobot * 100) + '% • ' + g.butir.join(', ') + '</div></div><b class="mono">' + (r.asp[gi] == null ? '—' : fmt.num(r.asp[gi], 2)) + '</b></li>').join('') + '</ul>' +
        '<div><div class="label-mono" style="margin-bottom:8px">Rincian per hari</div>' + (r.per.length
          ? '<div class="table-wrap"><table class="dt"><thead><tr><th>Hari</th><th>Mapel</th>' + A.map(g => '<th class="num">Σ ' + esc(g.nama.replace('Aspek ', '')) + '</th>').join('') + '<th class="num">Nilai</th></tr></thead><tbody>' +
            r.per.map(x => '<tr><td><b>' + esc(x.u.label) + '</b><div class="small muted">' + esc(fmt.tgl(x.u.s.Tanggal, { hari: true, short: true })) + '</div></td><td>' + esc(mapelName(x.u.s.ID_Mapel)) + '</td>' +
              x.j.map(v => '<td class="num mono">' + (terisi(x.v) ? fmtSkor(v) : '<span class="miss">0</span>') + '</td>').join('') + '<td class="num mono"><b>' + fmt.num(x.nh, 2) + '</b></td></tr>').join('') + '</tbody></table></div>'
          : '<p class="muted">Belum ada penilaian harian yang dikirim.</p>') + '</div>'
    });
  }

  function ekspor(kind, btn) {
    const d = dataMapel(data(st.kelas)), kl = R().kelas[st.kelas];
    if (!d || !kl) return;
    const res = rekapAkhir(d, S.boot.peserta.filter(p => p.ID_Kelas === st.kelas));
    if (!res.n) return toast('Belum ada nilai', 'Belum ada penilaian harian yang dikirim ke rekap untuk kelas ini.', 'warning');
    const first = res.units[0].s.Tanggal, last = res.units[res.n - 1].s.Tanggal;
    const gadikSet = Array.from(new Set(res.units.map(u => u.s.ID_Gadik).filter(Boolean)));
    const info = [['Kelas', kelasName(st.kelas, true)], ['Mata Pelajaran', st.mapel ? mapelName(st.mapel) : 'Semua mata pelajaran'], ['Gadik Pengampu', gadikSet.length ? gadikSet.map(gadikName).join(', ') : '—'],
      ['Jumlah hari penilaian', res.n + ' hari'], ['Periode', first === last ? tglPanjang(first) : tglPanjang(first) + ' – ' + tglPanjang(last)]];
    const out = {
      judul: 'REKAPITULASI NILAI AKHIR PESERTA PELATIHAN', instansi: String(CFG.INSTANSI || 'SPN Polda Papua Barat').toUpperCase(), ringkas: kl.Nama_Kelas + (st.mapel ? ' • ' + mapelName(st.mapel) : ''), info, format: PENILAIAN,
      ttd: ttdGadik(gadikSet.length === 1 ? gadikSet[0] : '', last),
      peserta: res.rows.map(r => ({ nama: r.Nama, pn: pangkatNrp(r.p) })),
      hari: res.units.map((u, ui) => ({
        label: u.label, judul: 'PENILAIAN HARIAN PESERTA PELATIHAN',
        info: [['Kelas', kelasName(st.kelas, true)], ['Mata Pelajaran', mapelName(u.s.ID_Mapel) + (u.s.Impor ? ' (hasil impor)' : '')], ['Hari / Tanggal', tglPanjang(u.s.Tanggal, true) + ' (' + u.label + ')'], ['Gadik', u.s.ID_Gadik ? gadikName(u.s.ID_Gadik) : '—']],
        nilai: res.rows.map(r => r.per[ui].v), ttd: ttdGadik(u.s.ID_Gadik, u.s.Tanggal)
      })),
      hasil: res.rows.map(r => ({ asp: r.asp, na: r.na, rank: r.rank }))
    };
    unduhBerkas(kind === 'pdf' ? 'akhirPdf' : 'akhirXlsx', out, namaBerkas(['Rekap-Akhir', kl.Nama_Kelas, st.mapel ? mapelName(st.mapel) : 'Semua-Mapel', kl.Nama_Angkatan], kind === 'pdf' ? 'pdf' : 'xlsx'), btn);
  }

  return {
    title: param => (param && R().kelas[param] ? 'Rekap Akhir — ' + R().kelas[param].Nama_Kelas : 'Rekap Akhir'),
    roles: ['Admin', 'Gadik'],
    show(root, param) {
      el = root;
      const k = String(param || '').split('/')[0];
      if (k) {
        if (k !== st.kelas) { st.pel = ''; st.q = ''; st.mapel = null; }
        st.kelas = k;
        renderDetail();
        if (R().kelas[k]) load(k, false);
      } else { st.kelas = ''; table = null; renderList(); }
    },
    onBoot(root, param) { if (!el || _modals.length) return; this.show(root, param); }
  };
})();
page('rekap-akhir', RekapAkhirPage);

// ==========================================================================
// PENGATURAN — ganti password (semua peran) + logo (Admin) (US-02, US-14)
// ==========================================================================
page('pengaturan', {
  title: 'Pengaturan',
  show(el) { renderSettings(el); },
  onBoot(el) { const f = el.querySelector('#pw-form'); if (!f || !f.contains(document.activeElement)) renderSettings(el); }
});

function renderSettings(el) {
  const me = S.me, isAdmin = S.role === 'Admin', set = S.boot.settings || {};
  const asg = S.boot.scope.pairs.map(a => kelasName(a.k, true) + (a.p ? ' — ' + pelName(a.p) : ''));
  el.innerHTML =
    pageHead({
      eyebrow: 'Sistem & Keamanan // Pengaturan',
      title: 'Pengaturan',
      desc: isAdmin ? 'Ganti password akun Anda dan ganti logo website yang tampil di halaman login, menu samping, dan ikon tab browser.' : 'Ganti password akun Anda secara berkala untuk menjaga keamanan data penilaian.'
    }) +
    '<div class="grid ' + (isAdmin ? 'c2' : 'c2') + '" style="align-items:start">' +
      '<div class="card"><div class="card-head"><div class="icon-tile">' + icon('key') + '</div><div class="grow"><h3>Keamanan Akun & Password</h3><div class="sub">Tersedia untuk semua peran</div></div></div>' +
        '<form id="pw-form" class="card-body" novalidate style="display:flex;flex-direction:column;gap:16px">' +
          '<div id="pw-alert" class="alert red" hidden></div>' +
          '<div class="field"><label for="pw-old">Password saat ini <span class="req">*</span></label><div class="input-wrap"><input id="pw-old" name="oldPassword" type="password" class="input" autocomplete="current-password"><button type="button" class="btn icon trail" data-eye="pw-old" aria-label="Tampilkan password">' + icon('eye') + '</button></div></div>' +
          '<div class="field"><label for="pw-new">Password baru <span class="req">*</span><span class="tag">Min. 8 karakter</span></label><div class="input-wrap"><input id="pw-new" name="newPassword" type="password" class="input" autocomplete="new-password"><button type="button" class="btn icon trail" data-eye="pw-new" aria-label="Tampilkan password">' + icon('eye') + '</button></div><div class="strength" id="pw-meter"><span></span><span></span><span></span><span></span></div><div class="hint" id="pw-meter-t"></div></div>' +
          '<div class="field"><label for="pw-new2">Konfirmasi password baru <span class="req">*</span></label><div class="input-wrap"><input id="pw-new2" name="newPassword2" type="password" class="input" autocomplete="new-password"><button type="button" class="btn icon trail" data-eye="pw-new2" aria-label="Tampilkan password">' + icon('eye') + '</button></div></div>' +
          '<div class="alert gold">' + icon('info') + '<div>Password disimpan sebagai hash SHA-256 + salt. Sesi berakhir otomatis setelah ' + (CFG.IDLE_MINUTES || 60) + ' menit tanpa aktivitas.</div></div>' +
          '<button class="btn primary block" id="pw-save" type="submit">' + icon('key') + 'Perbarui Password</button>' +
        '</form></div>' +
      (isAdmin ?
        '<div class="card" id="lg-card"><div class="card-head"><div class="icon-tile">' + icon('image') + '</div><div class="grow"><h3>Logo Website</h3><div class="sub">Tampil di halaman login, menu samping, dan ikon tab browser</div></div>' + roleBadge('Admin') + '</div>' +
          '<div class="card-body logo-box">' +
            '<div class="logo-now"><div class="logo-preview" id="lg-cur"></div><div><div class="label-mono" id="lg-cur-t">Logo saat ini</div><div class="logo-place" id="lg-place"></div></div></div>' +
            '<div><div class="label-mono" style="margin-bottom:8px">Ganti logo</div>' +
              '<label class="drop" id="lg-drop"><input type="file" id="lg-file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" hidden><div class="icon-tile">' + icon('cloud-up') + '</div><b>Pilih berkas atau seret logo ke sini</b><div class="hint mt-8">PNG, JPG, WEBP, atau SVG • maks. 5 MB</div></label>' +
              '<ul class="logo-spec"><li>Bentuk <b>persegi (1:1)</b>, minimal 256 × 256 piksel.</li><li>Latar <b>transparan atau putih</b> agar rapi di lingkaran halaman login.</li><li>Gambar diperkecil otomatis ke 256 px sebelum disimpan.</li></ul>' +
              '<div id="lg-msg" class="mt-8"></div>' +
              '<div class="logo-acts mt-16"><button class="btn primary" id="lg-save" disabled>' + icon('upload') + 'Simpan Logo</button>' +
              '<button class="btn outline" id="lg-reset"' + (set.logoVer || set.logoUrl ? '' : ' hidden') + '>' + icon('refresh') + 'Kembalikan Logo Bawaan</button></div>' +
            '</div></div></div>'
        :
        '<div class="card"><div class="card-head"><div class="icon-tile">' + icon('user') + '</div><div class="grow"><h3>Informasi Akun</h3><div class="sub">Diatur oleh Admin Satdik</div></div>' + roleBadge(me.Role) + '</div>' +
          '<div class="card-body"><dl class="kv"><dt>Nama</dt><dd>' + esc(me.Nama_Lengkap) + '</dd><dt>Username</dt><dd class="mono">' + esc(me.Username) + '</dd>' +
          (me.Pangkat ? '<dt>Pangkat</dt><dd>' + esc(me.Pangkat) + '</dd>' : '') + (me.NRP ? '<dt>NRP/NIP</dt><dd class="mono">' + esc(me.NRP) + '</dd>' : '') +
          '<dt>Penugasan</dt><dd>' + (asg.length ? asg.map(esc).join('<br>') : '—') + '</dd></dl></div></div>') +
    '</div>' +
    '<div class="card mt-24 pf-card"><div class="card-head"><div class="icon-tile">' + icon('camera') + '</div><div class="grow"><h3>Pas Foto 4 × 6</h3><div class="sub">Tampil di menu, bilah atas, dan daftar personel • format JPEG/JPG</div></div></div>' +
      '<div class="card-body pf-body">' + avatarAkun(me, 'pf-big') + '<div><p class="muted">Gunakan pas foto resmi (latar polos, wajah menghadap depan). Foto otomatis dipotong ke ukuran <b>4 × 6</b> dan diperkecil sebelum disimpan.</p>' +
      '<button type="button" class="btn primary mt-16" id="pf-ganti">' + icon('camera') + 'Ganti Pas Foto</button></div></div></div>' +
    (isAdmin ? '<div class="card mt-24"><div class="card-head"><div class="icon-tile">' + icon('database') + '</div><div class="grow"><h3>Pemeliharaan Sistem</h3><div class="sub">Berjalan otomatis di server Apps Script</div></div></div><div class="card-body"><div class="grid c3">' +
      '<div><div class="label-mono">Cadangan harian</div><p class="mt-8">Salinan database dibuat otomatis setiap pukul 02.00 WIT ke folder <b>Cadangan Harian</b> di Google Drive (14 salinan terakhir disimpan).</p></div>' +
      '<div><div class="label-mono">Penguncian nilai harian</div><p class="mt-8">Nilai yang sudah dikirim Gadik ke rekap otomatis terkunci. Buka kunci untuk koreksi lewat <b>Rekap Harian → Penilaian Harian</b>.</p></div>' +
      '<div><div class="label-mono">Versi</div><p class="mt-8"><span class="mono">SIPL ' + esc(set.version || FE_VERSION) + '</span> • Server Google Apps Script • Database Google Sheets</p></div>' +
      '</div></div></div>' : '');

  $('#pf-ganti', el).onclick = () => pilihPasFoto(S.me).then(v => { if (v !== null) { bootChanged(); if (typeof fillUser === 'function') fillUser(); } });
  const form = $('#pw-form', el);
  $$('[data-eye]', el).forEach(b => bindEye(b, $('#' + b.dataset.eye, el)));
  bindStrength($('#pw-new', el), $('#pw-meter', el), $('#pw-meter-t', el));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearErrors(form); $('#pw-alert', el).hidden = true;
    const v = formValues(form);
    if (!v.oldPassword) return fieldError(form, 'oldPassword', 'Isi password saat ini.');
    if (v.newPassword.length < 8) return fieldError(form, 'newPassword', 'Password baru minimal 8 karakter.');
    if (v.newPassword !== v.newPassword2) return fieldError(form, 'newPassword2', 'Konfirmasi password tidak sama.');
    const done = busy($('#pw-save', el), 'Memperbarui…');
    const res = await api('changePassword', { oldPassword: v.oldPassword, newPassword: v.newPassword });
    done();
    if (!res.success) return showServerError(form, res.code === 'BAD_CREDENTIALS' ? Object.assign({}, res, { data: { field: 'oldPassword' } }) : res, '#pw-alert');
    form.reset(); bindStrength($('#pw-new', el), $('#pw-meter', el), $('#pw-meter-t', el));
    toast('Password diperbarui', 'Gunakan password baru saat masuk berikutnya.');
  });

  if (!isAdmin) return;
  let picked = null;
  const drop = $('#lg-drop', el), file = $('#lg-file', el), msg = $('#lg-msg', el), save = $('#lg-save', el), reset = $('#lg-reset', el);
  const showLogo = (url, label) => {
    const img = url ? '<img src="' + esc(url) + '" alt="Logo" referrerpolicy="no-referrer">' : '';
    $('#lg-cur-t', el).textContent = label;
    $('#lg-cur', el).innerHTML = img || icon('shield-star', 'lg');
    $('#lg-place', el).innerHTML = '<div><div class="brand-logo">' + (img || icon('shield-star')) + '</div><small>Menu</small></div>' +
      '<div><div class="login-mini">' + (img || icon('shield-star')) + '</div><small>Login</small></div>';
  };
  showLogo(currentLogo(), 'Logo saat ini');
  const err = t => { msg.innerHTML = '<div class="alert red">' + icon('alert-circle') + '<div>' + esc(t) + '</div></div>'; };
  const pick = async f => {
    picked = null; save.disabled = true; msg.innerHTML = '';
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp|svg\+xml|gif)$/.test(f.type)) return err('Format tidak didukung. Gunakan PNG, JPG, WEBP, atau SVG.');
    if (f.size > 5 * 1024 * 1024) return err('Ukuran ' + fmt.num(f.size / 1048576, 1) + ' MB melebihi batas 5 MB.');
    msg.innerHTML = '<p class="hp-load"><span class="spin"></span>Menyiapkan logo…</p>';
    try { picked = await kecilkanLogo(f); }
    catch (e) { return err(e.message || 'Gambar tidak dapat dibaca.'); }
    picked.name = f.name;
    showLogo(picked.data, 'Pratinjau logo baru');
    const kb = Math.round(picked.b64.length * 0.75 / 1024);
    msg.innerHTML = '<div class="alert ' + (picked.w !== picked.h ? 'gold' : 'green') + '">' + icon(picked.w !== picked.h ? 'info' : 'check-circle') + '<div><b>' + esc(f.name) + '</b> • ' + picked.w + ' × ' + picked.h + ' px • ' + kb + ' KB' +
      (picked.w !== picked.h ? '<br>Logo tidak persegi — akan tampil dengan ruang kosong di sisi. Hasil terbaik: gambar persegi.' : ' — siap disimpan.') + '</div></div>';
    save.disabled = false;
  };
  const selesai = (res, judul, teks) => {
    S.boot.settings = res.data.settings;
    Store.set('public', { appName: res.data.settings.appName, logoUrl: res.data.settings.logoUrl, logoVer: res.data.settings.logoVer });
    if (res.data.logo && res.data.logo.ver) Store.set('logo', res.data.logo); else Store.del('logo');
    bootChanged();
    applyBranding();
    picked = null; save.disabled = true; file.value = '';
    reset.hidden = !(res.data.settings.logoVer || res.data.settings.logoUrl);
    showLogo(currentLogo(), 'Logo saat ini');
    toast(judul, teks);
  };
  file.onchange = () => pick(file.files[0]);
  ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => pick(e.dataTransfer.files[0]));
  save.onclick = async () => {
    if (!picked) return;
    const done = busy(save, 'Menyimpan…');
    const res = await api('logoUpload', { mime: picked.mime, base64: picked.b64, name: picked.name });
    done();
    if (!res.success) { save.disabled = false; return err(res.message); }
    msg.innerHTML = '';
    selesai(res, 'Logo diperbarui', 'Logo baru tampil di menu, halaman login, dan ikon tab di semua perangkat.');
  };
  reset.onclick = async () => {
    if (!(await confirmBox({ title: 'Kembalikan logo bawaan?', icon: 'refresh', okText: 'Kembalikan', text: 'Logo yang diunggah dihapus dan website kembali memakai logo bawaan.' }))) return;
    const done = busy(reset, 'Memproses…');
    const res = await api('logoUpload', { hapus: true });
    done();
    if (!res.success) return err(res.message);
    msg.innerHTML = '';
    selesai(res, 'Logo bawaan dipakai kembali', '');
  };
}

/** Perkecil logo di browser (maks. 256 px) → PNG; bila masih besar → WEBP/JPG. */
async function kecilkanLogo(f) {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('Gambar tidak dapat dibaca. Coba simpan ulang sebagai PNG.')); i.src = url; });
    const nw = img.naturalWidth || 256, nh = img.naturalHeight || 256, sc = Math.min(1, 256 / Math.max(nw, nh));
    const w = Math.max(1, Math.round(nw * sc)), h = Math.max(1, Math.round(nh * sc));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, w, h);
    const LIMIT = 150 * 1024;
    let best = null;
    for (const [type, q] of [['image/png'], ['image/webp', 0.92], ['image/webp', 0.8], ['image/jpeg', 0.88]]) {
      let cv = c;
      if (type === 'image/jpeg') { cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g2 = cv.getContext('2d'); g2.fillStyle = '#fff'; g2.fillRect(0, 0, w, h); g2.drawImage(c, 0, 0); }
      const d = cv.toDataURL(type, q);
      if (d.indexOf('data:' + type) !== 0) continue;
      const b64 = d.slice(d.indexOf(',') + 1);
      if (!best || b64.length < best.b64.length) best = { mime: type, data: d, b64, w, h };
      if (b64.length * 0.75 <= LIMIT) { best = { mime: type, data: d, b64, w, h }; break; }
    }
    if (!best || best.b64.length * 0.75 > 190 * 1024) throw new Error('Logo terlalu rumit untuk diperkecil. Gunakan gambar yang lebih sederhana.');
    return best;
  } finally { URL.revokeObjectURL(url); }
}
