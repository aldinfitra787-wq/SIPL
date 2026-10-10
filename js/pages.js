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
  def.show(el, param, { isNew });
  if (!prev || prev.name !== name || prev.param !== param) window.scrollTo(0, 0);
}
Bus.on('boot', () => {
  const c = S.current;
  if (c && !c.el.hidden && c.def.onBoot) c.def.onBoot(c.el, c.param);
});

const AKSI_LABEL = {
  LOGIN: 'Masuk', LOGIN_DIKUNCI: 'Login dikunci', INPUT_NILAI: 'Input nilai', INPUT_NILAI_MENTAL: 'Nilai mental',
  TAMBAH_PESERTA: 'Tambah peserta', UBAH_PESERTA: 'Ubah peserta', HAPUS_PESERTA: 'Hapus peserta',
  TAMBAH_AKUN: 'Tambah akun', UBAH_AKUN: 'Ubah akun', HAPUS_AKUN: 'Hapus akun', RESET_PASSWORD: 'Reset password',
  AKTIFKAN_AKUN: 'Aktifkan akun', NONAKTIFKAN_AKUN: 'Nonaktifkan akun', GANTI_PASSWORD: 'Ganti password',
  TAMBAH_MASTER: 'Tambah master', UBAH_MASTER: 'Ubah master', HAPUS_MASTER: 'Hapus master',
  TAMBAH_PENUGASAN: 'Tambah penugasan', HAPUS_PENUGASAN: 'Hapus penugasan', JADWAL_BENTROK_DISIMPAN: 'Jadwal bentrok',
  UBAH_LOGO: 'Ubah logo', IMPORT_DATA: 'Import data', LAMBAT: 'Respons lambat'
};
function aksiChip(a) {
  const red = /HAPUS|DIKUNCI|BENTROK|NONAKTIF|LAMBAT/.test(a);
  return '<span class="chip' + (red ? ' red' : '') + '">' + esc(AKSI_LABEL[a] || a) + '</span>';
}

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
// DASHBOARD (US-03, US-04)
// ==========================================================================
page('dashboard', {
  title: 'Dashboard',
  show(el) { renderDashboard(el); },
  onBoot(el) { renderDashboard(el); }
});

function renderDashboard(el) {
  if (S.role === 'Admin') return dashAdmin(el);
  if (S.role === 'Gadik') return dashGadik(el);
  return dashPengasuh(el);
}

function shortcut(href, ic, title, text, go, tone) {
  return '<a class="shortcut ' + (tone || '') + '" href="#/' + href + '"><div class="icon-tile' + (tone === 'red' ? ' red' : '') + '">' + icon(ic) + '</div><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p><span class="go">' + esc(go || 'Buka modul') + icon('arrow-right', 'sm') + '</span></a>';
}

function logsTable(logs) {
  if (!logs || !logs.length) return emptyState('activity', 'Belum ada aktivitas', 'Aktivitas perubahan data akan tercatat di sini.');
  return '<div class="table-wrap"><table class="dt cards"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Peran</th><th>Aksi</th><th>Detail</th></tr></thead><tbody>' +
    logs.map(l => '<tr><td data-label="Waktu" class="mono nowrap">' + esc(fmt.ago(l.Waktu)) + '</td>' +
      '<td data-label="Pengguna" class="card-title"><div class="t-name"><b>' + esc(l.Nama) + '</b></div></td>' +
      '<td data-label="Peran">' + (l.Role ? roleBadge(l.Role) : '<span class="faint">—</span>') + '</td>' +
      '<td data-label="Aksi">' + aksiChip(l.Aksi) + '</td>' +
      '<td data-label="Detail" class="wide">' + esc(l.Detail || '—') + '</td></tr>').join('') +
    '</tbody></table></div>';
}

function dashAdmin(el) {
  const b = S.boot, st = b.stat || {}, conf = findConflicts(b.jadwal);
  const nConf = Math.round(Object.keys(conf).reduce((s, k) => s + conf[k].length, 0) / 2);
  el.innerHTML =
    pageHead({
      eyebrow: 'TA ' + (CFG.TAHUN_AJARAN || new Date().getFullYear()) + ' // Diktuk Bintara & Dikbangspes',
      title: 'Dashboard Administrator',
      desc: 'Pusat kendali data akademik, jadwal pelajaran, personel pendidik dan pengasuh, serta rekap penilaian ' + esc(CFG.INSTANSI || 'SPN Polda Papua Barat') + '.',
      chips: roleBadge('Admin'),
      actions: '<a class="btn outline" href="#/jadwal">' + icon('calendar') + 'Atur Jadwal</a><a class="btn primary" href="#/akun/baru">' + icon('user-plus') + 'Tambah Akun</a>'
    }) +
    '<div class="grid c4 keep2">' +
      stat({ label: 'Kelas Aktif', value: st.kelasAktif || 0, unit: 'kelas', icon: 'building', cap: (st.kelasTotal || 0) + ' angkatan/kelas terdaftar' }) +
      stat({ label: 'Gadik', value: st.gadik || 0, unit: 'personel', icon: 'book', cap: 'Tenaga pendidik aktif' }) +
      stat({ label: 'Pengasuh', value: st.pengasuh || 0, unit: 'personel', icon: 'shield', cap: 'Pengasuh peserta didik aktif' }) +
      stat({ label: 'Peserta Didik', value: st.peserta || 0, unit: 'siswa', icon: 'users', cap: 'Diktuk Bintara & Dikbangspes' }) +
    '</div>' +
    (nConf ? '<div class="notice red mt-24"><div class="icon-tile">' + icon('alert-triangle') + '</div><div class="grow"><b>' + nConf + ' bentrok jadwal terdeteksi</b><p>Ada Gadik atau kelas yang dijadwalkan pada jam yang sama. Selesaikan agar jadwal valid.</p></div><a class="btn danger sm" href="#/jadwal">Tinjau jadwal</a></div>' : '') +
    '<div class="section-title"><h2>Menu Pintas</h2><span class="label-mono">Administrator</span></div>' +
    '<div class="grid c4">' +
      shortcut('personel', 'id-card', 'Personel & Akun', 'Kelola akun login Gadik dan Pengasuh, reset password, dan penugasan kelas/peleton.') +
      shortcut('jadwal', 'calendar', 'Jadwal Pelajaran', 'Matriks jadwal mingguan per kelas dengan deteksi bentrok Gadik dan kelas otomatis.') +
      shortcut('rekap', 'table', 'Rekap Nilai', 'Rekapitulasi nilai mata pelajaran dan nilai mental kepribadian per kelas.') +
      shortcut('master', 'database', 'Master Data', 'Angkatan & kelas, peleton, mata pelajaran, dan matriks penugasan personel.') +
    '</div>' +
    '<div class="card mt-24"><div class="card-head"><div class="icon-tile">' + icon('activity') + '</div><div class="grow"><h3>Aktivitas Terbaru</h3><div class="sub">Jejak perubahan data penting (nilai, akun, jadwal)</div></div><a class="btn outline sm" href="#/log">Lihat semua' + icon('arrow-right', 'sm') + '</a></div>' +
      logsTable(st.logs) + '</div>';
}

function todaySessions(jadwal) {
  const now = nowWIT();
  return jadwal.filter(j => j.Hari === now.hari).sort((a, b) => menit(a.Jam_Mulai) - menit(b.Jam_Mulai));
}
function sessionState(j, now) {
  if (j.Hari !== now.hari) return '';
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
function sessionCard(j, i, showKelas) {
  const now = nowWIT(), stt = sessionState(j, now);
  return '<div class="session ' + (stt === 'now' ? 'now' : stt === 'done' ? 'done' : '') + '"><div class="no"><small>SESI</small><b>' + pad2(i + 1) + '</b></div>' +
    '<div class="grow"><div class="row" style="gap:8px"><span class="time">' + esc(fmt.jam(j.Jam_Mulai)) + '–' + esc(fmt.jam(j.Jam_Selesai)) + ' WIT</span>' + (showKelas ? '<span class="chip">' + esc(kelasName(j.ID_Kelas)) + '</span>' : '') + sessionBadge(stt) + '</div>' +
    '<h3 class="mt-8">' + esc(mapelName(j.ID_Mapel)) + '</h3>' +
    '<div class="meta"><span>' + icon('user', 'sm') + esc(gadikName(j.ID_Gadik)) + '</span>' + (j.Ruang ? '<span>' + icon('map-pin', 'sm') + esc(j.Ruang) + '</span>' : '') + '</div></div></div>';
}

function dashGadik(el) {
  const b = S.boot, me = S.me, kelas = kelasList(), now = nowWIT();
  const taught = {};
  b.jadwal.filter(j => j.ID_Gadik === me.ID_Gadik).forEach(j => { taught[j.ID_Kelas + '|' + j.ID_Mapel] = 1; });
  const nilaiStat = (b.stat && b.stat.nilai) || {};
  const cnt = k => b.peserta.filter(p => p.ID_Kelas === k).length;
  const prog = Object.keys(taught).map(key => {
    const [k, m] = key.split('|'), total = cnt(k), done = (nilaiStat[k] && nilaiStat[k][m]) || 0;
    return { k, m, total, done, pct: total ? Math.round(done / total * 100) : 0 };
  });
  const today = todaySessions(b.jadwal);
  el.innerHTML =
    pageHead({
      eyebrow: 'Modul Akademik // Tenaga Pendidik',
      title: 'Dashboard Gadik',
      desc: 'Selamat datang, <b>' + esc(me.Nama_Lengkap) + '</b>' + (me.NRP ? ' <span class="nrp">NRP ' + esc(me.NRP) + '</span>' : '') + '. Kelola data dan nilai peserta didik di kelas penugasan Anda.',
      chips: roleBadge('Gadik') + '<span class="chip">' + icon('lock', 'sm') + 'Isolasi kelas sendiri</span>'
    }) +
    '<div class="notice"><div class="icon-tile">' + icon('shield-check') + '</div><div><b>Hak akses terbatas pada kelas penugasan</b><p>Anda hanya dapat melihat dan mengubah data peserta serta nilai di kelas yang ditugaskan Admin Satdik. Data kelas lain tidak dapat diakses.</p></div></div>' +
    (kelas.length ? '' : '<div class="notice red"><div class="icon-tile">' + icon('alert-triangle') + '</div><div><b>Belum ada penugasan kelas</b><p>Hubungi Admin Satdik agar akun Anda ditugaskan ke kelas.</p></div></div>') +
    '<div class="grid c3">' +
      '<div class="card pad"><div class="row between"><span class="label-mono">Kelas Binaan</span><div class="icon-tile">' + icon('building') + '</div></div>' +
        (kelas.length ? kelas.map(k => '<div class="mt-8"><b style="font-size:18px">' + esc(k.Nama_Kelas) + '</b><div class="muted small">' + esc(k.Nama_Angkatan) + ' • <span class="mono">' + cnt(k.ID_Kelas) + '</span> peserta</div></div>').join('') : '<p class="muted mt-8">—</p>') + '</div>' +
      '<div class="card pad"><div class="row between"><span class="label-mono">Mata Pelajaran Diampu</span><div class="icon-tile">' + icon('book') + '</div></div>' +
        (prog.length ? Array.from(new Set(prog.map(p => p.m))).map(m => '<div class="mt-8"><b>' + esc(mapelName(m)) + '</b></div>').join('') : '<p class="muted mt-8">Belum ada jadwal mengajar.</p>') + '</div>' +
      '<div class="card pad"><div class="row between"><span class="label-mono">Progres Pengisian Nilai</span><div class="icon-tile">' + icon('clipboard-check') + '</div></div>' +
        (prog.length ? prog.slice(0, 4).map(p => '<div class="mt-16"><div class="row between small"><span>' + esc(mapelName(p.m)) + ' • ' + esc(kelasName(p.k)) + '</span><b class="mono">' + p.done + '/' + p.total + '</b></div><div class="progress mt-8"><span style="width:' + p.pct + '%"></span></div></div>').join('') : '<p class="muted mt-8">Progres muncul setelah jadwal mengajar diatur.</p>') + '</div>' +
    '</div>' +
    '<div class="section-title"><h2>Menu Pintas</h2><span class="label-mono">Aksi cepat</span></div>' +
    '<div class="grid c3">' +
      shortcut('peserta', 'users', 'Data Peserta Didik', 'Tambah dan perbarui nama, pangkat, NRP, dan peleton peserta di kelas Anda.', 'Buka daftar') +
      shortcut('nilai', 'pen', 'Input Nilai Mapel', 'Isi nilai 0–100 per mata pelajaran. Tersimpan otomatis begitu Anda mengetik.', 'Mulai input') +
      shortcut('jadwal', 'calendar', 'Jadwal Kelas', 'Lihat jadwal pelajaran mingguan kelas Anda beserta pengajar dan ruangan.', 'Lihat jadwal') +
    '</div>' +
    '<div class="card mt-24"><div class="card-head"><div class="icon-tile">' + icon('clock') + '</div><div class="grow"><h3>Jadwal Kelas Hari Ini (' + esc(now.hari) + ')</h3><div class="sub">Zona waktu WIT (UTC+9)</div></div></div>' +
      '<div class="card-body">' + (today.length ? '<div class="sessions">' + today.map((j, i) => sessionCard(j, i, kelas.length > 1)).join('') + '</div>' : emptyState('calendar', 'Tidak ada pelajaran hari ini', 'Jadwal kelas Anda kosong untuk hari ' + now.hari + '.')) + '</div></div>';
}

function dashPengasuh(el) {
  const b = S.boot, me = S.me, sc = b.scope;
  const done = new Set((b.stat && b.stat.mentalDone) || []);
  const total = b.peserta.length, filled = b.peserta.filter(p => done.has(p.ID_Peserta)).length;
  const pct = total ? Math.round(filled / total * 100) : 0;
  const labels = sc.pairs.map(a => kelasName(a.k) + (a.p ? ' — ' + pelName(a.p) : ' (semua peleton)'));
  const belum = b.peserta.filter(p => !done.has(p.ID_Peserta)).sort((x, y) => collator.compare(x.Nama_Lengkap, y.Nama_Lengkap));
  const today = todaySessions(b.jadwal);
  el.innerHTML =
    pageHead({
      eyebrow: 'Korps Pengasuh // ' + (labels[0] || 'Belum ditugaskan'),
      title: 'Dashboard Pengasuh',
      desc: 'Selamat datang, <b>' + esc(me.Nama_Lengkap) + '</b>' + (me.NRP ? ' <span class="nrp">NRP ' + esc(me.NRP) + '</span>' : '') + '. Pantau dan input Nilai Mental Kepribadian peserta binaan Anda.',
      chips: roleBadge('Pengasuh') + '<span class="chip">' + icon('lock', 'sm') + 'Akses peleton binaan</span>'
    }) +
    '<div class="notice bur"><div class="icon-tile">' + icon('shield-check') + '</div><div><b>Pemberitahuan kewenangan pengasuh</b><p>Anda hanya dapat melihat data peserta dan menginput Nilai Mental Kepribadian pada kelas/peleton binaan Anda. Nilai mata pelajaran tidak dapat diakses.</p></div></div>' +
    (sc.pairs.length ? '' : '<div class="notice red"><div class="icon-tile">' + icon('alert-triangle') + '</div><div><b>Belum ada penugasan peleton</b><p>Hubungi Admin Satdik agar akun Anda ditugaskan ke kelas/peleton.</p></div></div>') +
    '<div class="grid c3">' +
      '<div class="card pad"><div class="row between"><span class="label-mono">Peleton Binaan</span><div class="icon-tile">' + icon('layers') + '</div></div>' +
        (labels.length ? labels.map(l => '<div class="mt-8"><b style="font-size:17px">' + esc(l) + '</b></div>').join('') : '<p class="muted mt-8">—</p>') +
        '<div class="muted small mt-8"><span class="mono">' + total + '</span> peserta asuhan</div></div>' +
      '<div class="card pad"><div class="row between"><span class="label-mono">Kelengkapan Nilai Mental</span><div class="icon-tile">' + icon('clipboard-check') + '</div></div>' +
        '<div class="stat" style="border:0;box-shadow:none;padding:0;min-height:0;margin-top:8px"><div class="big">' + filled + '<small>/ ' + total + ' peserta</small></div></div>' +
        '<div class="progress lg mt-8"><span style="width:' + pct + '%"></span></div><div class="row between small mt-8"><span class="muted">' + pct + '% terisi</span><span class="muted">' + (total - filled) + ' tersisa</span></div>' +
        '<a class="btn primary block mt-16" href="#/mental">Lanjutkan Input Nilai' + icon('arrow-right', 'sm') + '</a></div>' +
      '<div class="card pad"><div class="row between"><span class="label-mono">Jadwal Hari Ini</span><div class="icon-tile">' + icon('calendar') + '</div></div>' +
        (today.length ? '<ul class="list-clean mt-8">' + today.slice(0, 4).map(j => '<li><span class="mono small">' + esc(fmt.jam(j.Jam_Mulai)) + '</span><span class="grow">' + esc(mapelName(j.ID_Mapel)) + '</span>' + sessionBadge(sessionState(j, nowWIT())) + '</li>').join('') + '</ul>' : '<p class="muted mt-8">Tidak ada pelajaran hari ini.</p>') +
        '<a class="btn outline block mt-16" href="#/jadwal">Lihat jadwal lengkap</a></div>' +
    '</div>' +
    '<div class="card mt-24"><div class="card-head"><div class="icon-tile red">' + icon('alert-triangle') + '</div><div class="grow"><h3>Peserta Belum Dinilai</h3><div class="sub">Peserta asuhan yang belum memiliki Nilai Mental Kepribadian</div></div><span class="chip red">' + belum.length + ' peserta</span></div>' +
      (belum.length ? '<div class="table-wrap"><table class="dt cards"><thead><tr><th>No</th><th>Nama</th><th>NRP</th><th>Peleton</th><th></th></tr></thead><tbody>' +
        belum.slice(0, 8).map((p, i) => '<tr><td class="no">' + pad2(i + 1) + '</td><td data-label="Nama" class="card-title"><div class="t-person"><div class="avatar sm">' + esc(initials(p.Nama_Lengkap)) + '</div><div class="t-name"><b>' + esc(p.Nama_Lengkap) + '</b></div></div></td><td data-label="NRP"><span class="nrp">' + esc(p.NRP) + '</span></td><td data-label="Peleton">' + esc(pelName(p.ID_Peleton)) + '</td><td class="acts-cell right"><a class="btn outline xs" href="#/mental">Isi nilai</a></td></tr>').join('') +
        '</tbody></table></div>' + (belum.length > 8 ? '<div class="pager"><span>dan ' + (belum.length - 8) + ' peserta lainnya</span></div>' : '') :
        emptyState('check-circle', 'Semua peserta sudah dinilai', 'Kerja bagus! Nilai mental seluruh peserta asuhan sudah terisi.')) +
    '</div>';
}

// ==========================================================================
// PESERTA DIDIK (US-09, US-13)
// ==========================================================================
const PesertaPage = (() => {
  const st = { kelas: '', pel: '', q: '' };
  let el, table;

  function canEdit() { return S.role === 'Gadik'; }
  function myKelas() { return kelasList(); }

  function build(root) {
    el = root;
    const multi = S.role === 'Admin' || myKelas().length > 1;
    el.innerHTML =
      pageHead({
        eyebrow: S.role === 'Admin' ? 'Data Peserta Didik // Semua Kelas' : S.role === 'Gadik' ? 'Data Peserta Didik // Isolasi Kelas Binaan' : 'Data Peserta Didik // Peleton Binaan',
        title: 'Peserta Didik',
        desc: S.role === 'Gadik' ? 'Daftar resmi peserta di kelas penugasan Anda. Anda dapat menambah dan memperbarui nama, pangkat, NRP, dan peleton.' :
          S.role === 'Admin' ? 'Daftar peserta didik seluruh kelas (lihat saja). Data diinput oleh Gadik di masing-masing kelas.' :
          'Daftar peserta di kelas/peleton binaan Anda (lihat saja).',
        chips: S.role === 'Admin' ? '<span class="chip line">' + icon('eye', 'sm') + 'Mode lihat</span>' : '<span class="chip">' + icon('lock', 'sm') + (S.role === 'Gadik' ? 'Kelas penugasan' : 'Peleton binaan') + '</span>',
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
        if (act === 'edit') return openForm(R().peserta[id]);
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
      { key: 'Nama_Lengkap', label: 'Nama Lengkap', cls: 'card-title', render: r => '<div class="t-person"><div class="avatar sm">' + esc(initials(r.Nama_Lengkap)) + '</div><div class="t-name"><b>' + esc(r.Nama_Lengkap) + '</b><small>' + esc(r.Pangkat || 'Siswa') + '</small></div></div>' },
      { key: 'Pangkat', label: 'Pangkat', render: r => esc(r.Pangkat || 'Siswa') }
    ];
    if (S.role === 'Admin' || myKelas().length > 1) cols.push({ key: 'kelas', label: 'Kelas', sort: r => kelasName(r.ID_Kelas, true), render: r => esc(kelasName(r.ID_Kelas)) + '<div class="faint small">' + esc((R().kelas[r.ID_Kelas] || {}).Nama_Angkatan || '') + '</div>' });
    cols.push({ key: 'pel', label: 'Peleton', sort: r => pelName(r.ID_Peleton), render: r => r.ID_Peleton ? '<span class="chip line">' + esc(pelName(r.ID_Peleton)) + '</span>' : '<span class="faint">—</span>' });
    if (canEdit()) cols.push({ key: 'acts', label: 'Aksi', sort: false, cls: 'acts-cell', render: () => '<div class="acts"><button class="btn icon" data-act="edit" title="Ubah">' + icon('edit') + '</button><button class="btn icon red" data-act="del" title="Hapus">' + icon('trash') + '</button></div>' });
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
      title: (isEdit ? 'Ubah Peserta Didik — ' : 'Tambah Peserta Didik — ') + kelasName(kSel), sub: 'Registrasi buku induk peserta', icon: isEdit ? 'edit' : 'user-plus',
      body: '<form id="pf" class="form-grid" novalidate>' +
        '<div id="pf-alert" class="alert red span-all" hidden></div>' +
        '<div class="field"><label>NRP <span class="req">*</span><span class="tag">Wajib unik</span></label><input name="NRP" class="input mono" value="' + esc(isEdit ? p.NRP : '') + '" maxlength="25" placeholder="Contoh: 03051004" autocomplete="off"><div class="hint">Angka/huruf tanpa spasi. NRP tidak boleh sama dengan peserta lain.</div></div>' +
        '<div class="field"><label>Pangkat</label><input name="Pangkat" class="input" value="' + esc(isEdit ? p.Pangkat : 'Siswa') + '" maxlength="40"></div>' +
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
    const ok = await confirmBox({ title: 'Hapus peserta?', danger: true, okText: 'Hapus', html: 'Data <b>' + esc(p.Nama_Lengkap) + '</b> (NRP ' + esc(p.NRP) + ') akan dihapus. Peserta yang sudah memiliki nilai tidak dapat dihapus.' });
    if (!ok) return;
    const res = await api('pesertaDelete', { ID_Peserta: p.ID_Peserta });
    if (!res.success) return toast('Tidak dapat menghapus', res.message, 'error');
    S.boot.peserta = S.boot.peserta.filter(x => x.ID_Peserta !== p.ID_Peserta);
    bootChanged();
    toast('Peserta dihapus', p.Nama_Lengkap);
    refresh(true);
  }

  return {
    title: 'Peserta Didik',
    show(root, param, o) { if (o.isNew || !table) build(root); fillKelas(); fillPel(); refresh(!o.isNew); },
    onBoot() { if (!el) return; fillKelas(); fillPel(); refresh(true); }
  };
})();
page('peserta', PesertaPage);

// ==========================================================================
// JADWAL — lihat saja (Gadik & Pengasuh). Admin memakai versi admin.js.
// ==========================================================================
const JadwalView = (() => {
  const st = { kelas: '', day: '' };
  let el;
  function render() {
    const kel = kelasList();
    if (!kel.some(k => k.ID_Kelas === st.kelas)) st.kelas = kel[0] ? kel[0].ID_Kelas : '';
    const now = nowWIT();
    if (!st.day) st.day = HARI.slice(0, 6).indexOf(now.hari) > -1 ? now.hari : 'Senin';
    const all = S.boot.jadwal.filter(j => j.ID_Kelas === st.kelas);
    const days = HARI.filter((h, i) => i < 6 || all.some(j => j.Hari === h));
    const list = all.filter(j => j.Hari === st.day).sort((a, b) => menit(a.Jam_Mulai) - menit(b.Jam_Mulai));
    const totalMin = all.reduce((s, j) => s + Math.max(0, menit(j.Jam_Selesai) - menit(j.Jam_Mulai)), 0);
    const pairLabel = S.role === 'Pengasuh' ? S.boot.scope.pairs.filter(a => a.k === st.kelas).map(a => a.p ? pelName(a.p) : 'Semua peleton').join(', ') : '';
    el.innerHTML =
      pageHead({
        eyebrow: 'Jadwal Resmi Kelas Binaan // Mode Lihat Saja',
        title: 'Jadwal Pelajaran',
        desc: st.kelas ? esc(kelasName(st.kelas, true)) + (pairLabel ? ' — ' + esc(pairLabel) : '') : 'Belum ada kelas yang ditugaskan.',
        chips: '<span class="chip line">' + icon('eye', 'sm') + 'Hanya lihat</span>',
        actions: kel.length > 1 ? '<select class="select" id="jv-kelas" style="min-width:240px">' + options(kel, 'ID_Kelas', k => k.Nama_Kelas + ' — ' + k.Nama_Angkatan, st.kelas) + '</select>' : ''
      }) +
      '<div class="notice"><div class="icon-tile">' + icon('lock') + '</div><div><b>Tampilan terisolasi (lihat saja)</b><p>Gadik dan Pengasuh tidak dapat mengubah jadwal. Hubungi Admin Satdik untuk permohonan perubahan jam atau tukar mengajar.</p></div></div>' +
      '<div class="card"><div class="card-head"><div class="day-chips" role="tablist">' +
        days.map(h => '<button role="tab" data-day="' + h + '" class="' + (h === st.day ? 'on ' : '') + (h === now.hari ? 'today' : '') + '" aria-selected="' + (h === st.day) + '">' + h + '</button>').join('') +
      '</div><span class="grow"></span><span class="chip line">' + icon('clock', 'sm') + list.length + ' sesi • WIT</span></div>' +
      '<div class="card-body">' + (list.length ? '<div class="sessions">' + list.map((j, i) => sessionCard(j, i, false)).join('') + '</div>' :
        emptyState('calendar', 'Tidak ada pelajaran', 'Belum ada jadwal pada hari ' + st.day + ' untuk kelas ini.')) + '</div></div>' +
      '<div class="grid c3 mt-24">' +
        stat({ label: 'Sesi per Pekan', value: all.length, unit: 'sesi', icon: 'calendar', cap: 'Seluruh hari untuk kelas ini' }) +
        stat({ label: 'Total Jam per Pekan', value: fmt.num(totalMin / 60, totalMin % 60 ? 1 : 0), unit: 'jam', icon: 'clock', cap: 'Akumulasi durasi tatap muka' }) +
        stat({ label: 'Mata Pelajaran', value: new Set(all.map(j => j.ID_Mapel)).size, unit: 'mapel', icon: 'book', cap: 'Diajarkan di kelas ini' }) +
      '</div>';
    $$('[data-day]', el).forEach(b => { b.onclick = () => { st.day = b.dataset.day; render(); }; });
    const ks = $('#jv-kelas', el);
    if (ks) ks.onchange = () => { st.kelas = ks.value; render(); };
  }
  return { show(root) { el = root; render(); }, onBoot(root) { el = root; render(); } };
})();

page('jadwal', {
  title: 'Jadwal Pelajaran',
  show(el, param, o) { (S.role === 'Admin' && window.JadwalAdmin ? window.JadwalAdmin : JadwalView).show(el, param, o); },
  onBoot(el, param) { (S.role === 'Admin' && window.JadwalAdmin ? window.JadwalAdmin : JadwalView).onBoot(el, param); }
});

// ==========================================================================
// INPUT NILAI MATA PELAJARAN — Gadik (US-10)
// ==========================================================================
const NilaiPage = (() => {
  const st = { kelas: '', mapel: '', pel: '', status: '', q: '' };
  let el, table, saver, loadErr = null;
  const data = () => (S.data.nilai || {})[st.kelas];
  const savedOf = pid => { const d = data(); const m = d && d.nilai[st.mapel]; return m ? m[pid] : null; };

  function build(root) {
    el = root;
    el.innerHTML =
      pageHead({
        eyebrow: 'Penilaian Akademik // Input Nilai',
        title: 'Input Nilai Mata Pelajaran',
        desc: 'Pilih kelas dan mata pelajaran, lalu isi nilai 0–100. Nilai <b>tersimpan otomatis</b> beberapa detik setelah Anda berhenti mengetik — tekan <span class="kbd">Enter</span> untuk pindah ke peserta berikutnya.',
        chips: '<span class="chip ink">' + icon('lock', 'sm') + '<span id="nv-scope">Kelas</span></span>'
      }) +
      '<div class="card"><div class="toolbar">' +
        '<div class="field"><label for="nv-kelas">Kelas</label><select id="nv-kelas" class="select"></select></div>' +
        '<div class="field"><label for="nv-mapel">Mata Pelajaran</label><select id="nv-mapel" class="select"></select></div>' +
        '<div class="field narrow"><label for="nv-pel">Peleton</label><select id="nv-pel" class="select"></select></div>' +
        '<div class="field narrow"><label for="nv-status">Status</label><select id="nv-status" class="select"><option value="">Semua</option><option value="empty">Belum diisi</option><option value="saved">Tersimpan</option><option value="draft">Draf / gagal</option></select></div>' +
        '<div class="field search"><label for="nv-q">Cari</label><div class="input-wrap">' + icon('search', 'lead') + '<input id="nv-q" class="input with-lead" placeholder="Nama atau NRP…" autocomplete="off"></div></div>' +
      '</div><div id="nv-table"></div></div>' +
      '<div class="sticky-bar"><div class="prog"><div class="row between"><b>Progres pengisian</b><span class="mono" id="nv-prog-t">0/0</span></div><div class="progress"><span id="nv-prog" style="width:0"></span></div></div>' +
        '<span class="small muted" id="nv-save-state">' + icon('check-circle', 'sm') + ' Semua perubahan tersimpan</span>' +
        '<button class="btn outline" id="nv-reset">Batalkan Draf</button><button class="btn primary" id="nv-save">' + icon('save') + 'Simpan Sekarang</button></div>';

    table = new Table($('#nv-table', el), {
      key: 'ID_Peserta', unit: 'peserta', pageSize: 50, sizes: [25, 50, 100], sort: { key: 'Nama_Lengkap', dir: 'asc' },
      columns: [
        { key: 'no', label: 'No', sort: false, cls: 'no', render: (r, i) => pad2(i + 1) },
        { key: 'NRP', label: 'NRP', render: r => '<span class="nrp">' + esc(r.NRP) + '</span>' },
        { key: 'Nama_Lengkap', label: 'Nama Peserta', cls: 'card-title', render: r => '<div class="t-name"><b>' + esc(r.Nama_Lengkap) + '</b><small>' + esc(pelName(r.ID_Peleton)) + '</small></div>' },
        { key: 'pel', label: 'Peleton', sort: r => pelName(r.ID_Peleton), render: r => esc(pelName(r.ID_Peleton)) },
        { key: 'nilai', label: 'Nilai (0–100)', sort: r => { const v = valueOf(r.ID_Peserta); return v === '' ? '' : Number(v); }, render: r => gradeInput(r.ID_Peserta) },
        { key: 'status', label: 'Status', sort: r => statusKey(r.ID_Peserta), render: r => '<span data-st="' + esc(r.ID_Peserta) + '">' + statusHtml(r.ID_Peserta) + '</span>' },
        { key: 'at', label: 'Diperbarui', sort: r => { const s = savedOf(r.ID_Peserta); return s ? s[1] : ''; }, render: r => '<span class="small muted" data-at="' + esc(r.ID_Peserta) + '">' + atHtml(r.ID_Peserta) + '</span>' }
      ],
      empty: () => emptyState('users', 'Tidak ada peserta', st.q ? 'Tidak ada peserta yang cocok.' : 'Belum ada peserta di kelas ini. Tambahkan lewat menu Peserta Didik.', st.q ? '' : '<a class="btn primary" href="#/peserta">Buka Peserta Didik</a>'),
      afterRender: updateProgress
    });

    const host = $('#nv-table', el);
    host.addEventListener('input', e => { if (e.target.matches('.grade-in')) onInput(e.target); });
    host.addEventListener('keydown', e => {
      if (!e.target.matches('.grade-in')) return;
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const ins = $$('.grade-in', host), i = ins.indexOf(e.target), n = ins[i + (e.key === 'ArrowUp' ? -1 : 1)];
        if (n) { n.focus(); n.select(); }
      }
    });
    host.addEventListener('click', e => { if (e.target.closest('[data-retry]')) load(true); });
    $('#nv-kelas', el).onchange = e => { switchTo(e.target.value, st.mapel); };
    $('#nv-mapel', el).onchange = e => { switchTo(st.kelas, e.target.value); };
    $('#nv-pel', el).onchange = e => { st.pel = e.target.value; refresh(); };
    $('#nv-status', el).onchange = e => { st.status = e.target.value; refresh(); };
    $('#nv-q', el).addEventListener('input', debounce(e => { st.q = e.target.value; refresh(); }, 250));
    $('#nv-save', el).onclick = () => { if (saver && saver.count()) saver.flush(); else toast('Tidak ada perubahan', 'Semua nilai sudah tersimpan.', 'info'); };
    $('#nv-reset', el).onclick = async () => {
      if (!saver || !saver.count()) return toast('Tidak ada draf', 'Tidak ada nilai yang belum tersimpan.', 'info');
      if (await confirmBox({ title: 'Batalkan draf?', text: saver.count() + ' nilai yang belum tersimpan akan dikembalikan ke nilai terakhir.', okText: 'Batalkan draf', danger: true })) { saver.clear(); refresh(true); }
    };
  }

  function myMapelIds(k) {
    const ids = new Set();
    S.boot.jadwal.forEach(j => { if (j.ID_Kelas === k && j.ID_Gadik === S.me.ID_Gadik) ids.add(j.ID_Mapel); });
    return ids;
  }
  function fillSelects() {
    const kel = kelasList();
    if (!kel.some(k => k.ID_Kelas === st.kelas)) st.kelas = kel[0] ? kel[0].ID_Kelas : '';
    const ks = $('#nv-kelas', el);
    ks.innerHTML = options(kel, 'ID_Kelas', k => k.Nama_Kelas + ' — ' + k.Nama_Angkatan, st.kelas, kel.length ? null : 'Belum ada kelas');
    ks.disabled = kel.length <= 1;
    const mine = myMapelIds(st.kelas), all = mapelList(true);
    if (!all.some(m => m.ID_Mapel === st.mapel)) st.mapel = (all.find(m => mine.has(m.ID_Mapel)) || all[0] || {}).ID_Mapel || '';
    const a = all.filter(m => mine.has(m.ID_Mapel)), b = all.filter(m => !mine.has(m.ID_Mapel));
    $('#nv-mapel', el).innerHTML = !all.length ? '<option value="">Belum ada mata pelajaran</option>' :
      (a.length ? '<optgroup label="Mapel yang Anda ajar">' + options(a, 'ID_Mapel', m => m.Nama_Mapel, st.mapel) + '</optgroup><optgroup label="Mapel lain">' + options(b, 'ID_Mapel', m => m.Nama_Mapel, st.mapel) + '</optgroup>' : options(all, 'ID_Mapel', m => m.Nama_Mapel, st.mapel));
    const pels = pelOf(st.kelas);
    if (st.pel && !pels.some(p => p.ID_Peleton === st.pel)) st.pel = '';
    $('#nv-pel', el).innerHTML = options(pels, 'ID_Peleton', p => p.Nama_Peleton, st.pel, 'Semua');
    $('#nv-scope', el).textContent = 'Isolasi kelas: ' + (st.kelas ? kelasName(st.kelas) : '—');
  }

  function makeSaver() {
    if (saver) saver.dispose();
    if (!st.kelas || !st.mapel) { saver = null; return; }
    const kelas = st.kelas, mapel = st.mapel;
    saver = new AutoSaver({
      key: 'draft:nilai:' + kelas + ':' + mapel,
      delay: 1500,
      send: batch => api('nilaiSave', { idKelas: kelas, idMapel: mapel, items: Object.keys(batch).map(id => ({ id, nilai: batch[id] })) }),
      onState: id => { if (st.kelas === kelas && st.mapel === mapel) updateRow(id); },
      onSaved: res => {
        const d = (S.data.nilai || {})[kelas];
        if (d) {
          d.nilai[mapel] = d.nilai[mapel] || {};
          res.data.saved.forEach(s => { if (s.nilai === '') delete d.nilai[mapel][s.id]; else d.nilai[mapel][s.id] = [s.nilai, s.waktu, S.me.Nama_Lengkap]; });
          cachePut('nilai:' + kelas, d);
          const stt = S.boot.stat.nilai = S.boot.stat.nilai || {};
          stt[kelas] = stt[kelas] || {};
          stt[kelas][mapel] = Object.keys(d.nilai[mapel]).length;
          cachePut('boot', S.boot);
        }
        if (res.data.saved.length) toast('Nilai tersimpan', res.data.saved.length + ' nilai ' + mapelName(mapel) + ' tersimpan ke database.');
        updateProgress();
      },
      onFail: res => toast('Gagal menyimpan nilai', res.message + ' Draf tetap aman di perangkat ini.', 'error')
    });
  }

  function switchTo(kelas, mapel) {
    if (saver && saver.count()) saver.flush();
    const changedKelas = kelas !== st.kelas;
    st.kelas = kelas; st.mapel = mapel;
    if (changedKelas) st.pel = '';
    fillSelects(); makeSaver(); load(false);
  }

  function valueOf(pid) {
    if (saver && saver.has(pid)) return saver.get(pid);
    const s = savedOf(pid);
    return s ? s[0] : '';
  }
  function statusKey(pid) { const s = saver ? saver.state(pid) : ''; return s || (savedOf(pid) ? 'saved' : 'empty'); }
  function statusHtml(pid) { const s = saver ? saver.state(pid) : ''; return saveBadge(s, savedOf(pid) ? 1 : 0, saver && saver.errors[pid]); }
  function atHtml(pid) { const s = savedOf(pid); return s ? esc(fmt.ago(s[1])) + (s[2] && s[2] !== S.me.Nama_Lengkap ? '<br><span class="faint">' + esc(s[2]) + '</span>' : '') : '—'; }
  function gradeInput(pid) {
    const v = valueOf(pid), dirty = saver && saver.has(pid);
    return '<div class="grade-cell"><input class="input grade-in' + (dirty ? ' dirty' : '') + '" inputmode="decimal" autocomplete="off" maxlength="6" data-pid="' + esc(pid) + '" value="' + esc(v === '' ? '' : String(v).replace('.', ',')) + '" placeholder="0–100" aria-label="Nilai"><span class="of">/100</span></div>';
  }

  function onInput(input) {
    const pid = input.dataset.pid, p = parseGrade(input.value), saved = savedOf(pid);
    input.classList.toggle('invalid', !!p.error);
    if (p.error) {
      if (saver) saver.unset(pid);
      $('[data-st="' + CSS.escape(pid) + '"]', el).innerHTML = saveBadge('invalid');
      return;
    }
    const val = p.empty ? '' : p.value, savedVal = saved ? saved[0] : '';
    if (String(val) === String(savedVal)) saver.unset(pid); else saver.set(pid, val);
    input.classList.toggle('dirty', saver.has(pid));
    updateProgress();
  }

  function updateRow(pid) {
    const sEl = el.querySelector('[data-st="' + CSS.escape(pid) + '"]');
    if (sEl) sEl.innerHTML = statusHtml(pid);
    const aEl = el.querySelector('[data-at="' + CSS.escape(pid) + '"]');
    if (aEl) aEl.innerHTML = atHtml(pid);
    const inp = el.querySelector('.grade-in[data-pid="' + CSS.escape(pid) + '"]');
    if (inp) {
      inp.classList.toggle('dirty', !!(saver && saver.has(pid)));
      if (document.activeElement !== inp && !(saver && saver.has(pid))) { const v = valueOf(pid); inp.value = v === '' ? '' : String(v).replace('.', ','); inp.classList.remove('invalid'); }
    }
    updateSaveState();
  }
  function updateSaveState() {
    const box = $('#nv-save-state', el);
    if (!box) return;
    const n = saver ? saver.count() : 0, err = saver ? Object.keys(saver.errors).length : 0;
    box.innerHTML = err ? '<span style="color:var(--red)">' + icon('alert-circle', 'sm') + ' ' + err + ' gagal disimpan</span>' :
      n ? icon('clock', 'sm') + ' ' + n + ' perubahan menunggu disimpan' : icon('check-circle', 'sm') + ' Semua perubahan tersimpan';
  }
  function updateProgress() {
    const all = S.boot.peserta.filter(p => p.ID_Kelas === st.kelas);
    const filled = all.filter(p => { const v = valueOf(p.ID_Peserta); return v !== '' && v != null; }).length;
    const t = $('#nv-prog-t', el), b = $('#nv-prog', el);
    if (t) t.textContent = filled + '/' + all.length + ' peserta (' + (all.length ? Math.round(filled / all.length * 100) : 0) + '%)';
    if (b) b.style.width = (all.length ? filled / all.length * 100 : 0) + '%';
    updateSaveState();
  }

  function rows() {
    const q = norm(st.q);
    return S.boot.peserta.filter(p => {
      if (p.ID_Kelas !== st.kelas || (st.pel && p.ID_Peleton !== st.pel)) return false;
      if (q && norm(p.Nama_Lengkap).indexOf(q) === -1 && String(p.NRP).indexOf(q) === -1) return false;
      if (st.status) {
        const k = statusKey(p.ID_Peserta);
        if (st.status === 'empty' && k !== 'empty') return false;
        if (st.status === 'saved' && k !== 'saved') return false;
        if (st.status === 'draft' && ['draft', 'error', 'saving'].indexOf(k) === -1) return false;
      }
      return true;
    });
  }

  function refresh(keepPage) {
    if (!st.kelas) { $('#nv-table', el).innerHTML = emptyState('building', 'Belum ada kelas', 'Akun Anda belum ditugaskan ke kelas. Hubungi Admin Satdik.'); return; }
    if (!st.mapel) { $('#nv-table', el).innerHTML = emptyState('book', 'Belum ada mata pelajaran', 'Admin Satdik perlu menambahkan mata pelajaran terlebih dahulu.'); return; }
    if (!data()) { $('#nv-table', el).innerHTML = loadErr ? errorState(loadErr) : skeletonRows(6, 5); updateProgress(); return; }
    table.set(rows(), keepPage);
  }

  function load(force) {
    loadErr = null;
    const kelas = st.kelas;
    if (!kelas) return refresh();
    S.data.nilai = S.data.nilai || {};
    refresh();
    swr('nilai:' + kelas, 'nilaiList', { idKelas: kelas }, d => {
      S.data.nilai[kelas] = d;
      if (st.kelas !== kelas) return;
      const focused = el.contains(document.activeElement) && document.activeElement.matches('.grade-in');
      if (focused && $('.grade-in', el)) { $$('.grade-in', el).forEach(i => updateRow(i.dataset.pid)); updateProgress(); }
      else refresh(true);
    }, { fresh: force ? 0 : 30000, force, onError: res => { loadErr = res.message; if (st.kelas === kelas) refresh(); } });
  }

  return {
    title: 'Input Nilai',
    roles: ['Gadik'],
    show(root, param, o) {
      if (o.isNew || !table) build(root);
      fillSelects();
      if (!saver || saver.o.key !== 'draft:nilai:' + st.kelas + ':' + st.mapel) makeSaver();
      load(false);
    },
    onBoot() { if (!el) return; const k = st.kelas, m = st.mapel; fillSelects(); if (k !== st.kelas || m !== st.mapel) makeSaver(); refresh(true); },
    leave() { if (saver && saver.count()) saver.flush(); }
  };
})();
page('nilai', NilaiPage);

// ==========================================================================
// NILAI MENTAL KEPRIBADIAN — Pengasuh (US-11)
// ==========================================================================
const MentalPage = (() => {
  const st = { pair: '', status: '', q: '' };
  let el, table, saver, loadErr = null;
  const savedOf = pid => (S.data.mental || {})[pid] || null;

  function build(root) {
    el = root;
    el.innerHTML =
      pageHead({
        eyebrow: 'Korps Pengasuh // Penilaian Mental Kepribadian',
        title: 'Nilai Mental Kepribadian',
        desc: 'Isi skor mental kepribadian (0–100) dan catatan pembinaan untuk peserta binaan Anda. Perubahan <b>tersimpan otomatis</b>.',
        chips: '<span class="chip ink">' + icon('lock', 'sm') + 'Akses peleton binaan</span><span class="chip red">Nilai mapel tidak dapat diakses</span>'
      }) +
      '<div class="grid c3 keep2" id="mt-stats"></div>' +
      '<div class="card mt-24"><div class="toolbar">' +
        '<div class="field"><label for="mt-pair">Kelas & Peleton</label><select id="mt-pair" class="select"></select></div>' +
        '<div class="field narrow"><label for="mt-status">Status</label><select id="mt-status" class="select"><option value="">Semua</option><option value="empty">Belum dinilai</option><option value="saved">Tersimpan</option><option value="draft">Draf / gagal</option></select></div>' +
        '<div class="field search"><label for="mt-q">Cari</label><div class="input-wrap">' + icon('search', 'lead') + '<input id="mt-q" class="input with-lead" placeholder="Nama atau NRP…" autocomplete="off"></div></div>' +
      '</div><div id="mt-table"></div></div>' +
      '<div class="sticky-bar"><div class="prog"><div class="row between"><b>Peserta dinilai</b><span class="mono" id="mt-prog-t">0/0</span></div><div class="progress"><span id="mt-prog" style="width:0"></span></div></div>' +
        '<span class="small muted" id="mt-save-state"></span>' +
        '<button class="btn outline" id="mt-reset">Batalkan Draf</button><button class="btn primary" id="mt-save">' + icon('save') + 'Simpan Sekarang</button></div>';
    table = new Table($('#mt-table', el), {
      key: 'ID_Peserta', unit: 'peserta', pageSize: 50, sizes: [25, 50, 100], sort: { key: 'Nama_Lengkap', dir: 'asc' },
      columns: [
        { key: 'no', label: 'No', sort: false, cls: 'no', render: (r, i) => pad2(i + 1) },
        { key: 'Nama_Lengkap', label: 'Peserta', cls: 'card-title', render: r => '<div class="t-person"><div class="avatar sm">' + esc(initials(r.Nama_Lengkap)) + '</div><div class="t-name"><b>' + esc(r.Nama_Lengkap) + '</b><small><span class="mono">' + esc(r.NRP) + '</span> • ' + esc(pelName(r.ID_Peleton)) + '</small></div></div>' },
        { key: 'nilai', label: 'Skor (0–100)', sort: r => { const v = cur(r.ID_Peserta).n; return v === '' ? '' : Number(v); }, render: r => '<div class="grade-cell"><input class="input grade-in' + (saver && saver.has(r.ID_Peserta) ? ' dirty' : '') + '" inputmode="decimal" maxlength="6" autocomplete="off" data-pid="' + esc(r.ID_Peserta) + '" value="' + esc(String(cur(r.ID_Peserta).n).replace('.', ',')) + '" placeholder="0–100" aria-label="Skor mental"><span class="of">/100</span></div>' },
        { key: 'catatan', label: 'Catatan Pembinaan', sort: false, cls: 'wide', render: r => '<textarea class="textarea note-in" data-note="' + esc(r.ID_Peserta) + '" maxlength="1000" placeholder="Catatan sikap, disiplin, atau prestasi (opsional)" aria-label="Catatan">' + esc(cur(r.ID_Peserta).c) + '</textarea>' },
        { key: 'status', label: 'Status', sort: r => statusKey(r.ID_Peserta), render: r => '<span data-st="' + esc(r.ID_Peserta) + '">' + statusHtml(r.ID_Peserta) + '</span><div class="small faint mt-8" data-at="' + esc(r.ID_Peserta) + '">' + atHtml(r.ID_Peserta) + '</div>' }
      ],
      empty: () => emptyState('users', 'Tidak ada peserta', st.q ? 'Tidak ada peserta yang cocok.' : 'Belum ada peserta di peleton binaan Anda.'),
      afterRender: updateProgress
    });
    const host = $('#mt-table', el);
    host.addEventListener('input', e => { if (e.target.matches('.grade-in, .note-in')) onInput(e.target.dataset.pid || e.target.dataset.note); });
    host.addEventListener('keydown', e => {
      if (!e.target.matches('.grade-in') || ['Enter', 'ArrowDown', 'ArrowUp'].indexOf(e.key) === -1) return;
      e.preventDefault();
      const ins = $$('.grade-in', host), i = ins.indexOf(e.target), n = ins[i + (e.key === 'ArrowUp' ? -1 : 1)];
      if (n) { n.focus(); n.select(); }
    });
    host.addEventListener('click', e => { if (e.target.closest('[data-retry]')) load(true); });
    $('#mt-pair', el).onchange = e => { st.pair = e.target.value; refresh(); };
    $('#mt-status', el).onchange = e => { st.status = e.target.value; refresh(); };
    $('#mt-q', el).addEventListener('input', debounce(e => { st.q = e.target.value; refresh(); }, 250));
    $('#mt-save', el).onclick = () => { if (saver.count()) saver.flush(); else toast('Tidak ada perubahan', 'Semua nilai sudah tersimpan.', 'info'); };
    $('#mt-reset', el).onclick = async () => {
      if (!saver.count()) return toast('Tidak ada draf', 'Tidak ada perubahan yang belum tersimpan.', 'info');
      if (await confirmBox({ title: 'Batalkan draf?', text: saver.count() + ' perubahan yang belum tersimpan akan dibuang.', okText: 'Batalkan draf', danger: true })) { saver.clear(); refresh(true); }
    };
    makeSaver();
  }

  function makeSaver() {
    if (saver) return;
    saver = new AutoSaver({
      key: 'draft:mental', delay: 1800,
      send: batch => api('mentalSave', { items: Object.keys(batch).map(id => ({ id, nilai: batch[id].n, catatan: batch[id].c })) }),
      onState: id => updateRow(id),
      onSaved: res => {
        S.data.mental = S.data.mental || {};
        res.data.saved.forEach(s => {
          if (s.nilai === '' && !s.catatan) delete S.data.mental[s.id];
          else S.data.mental[s.id] = [s.nilai, s.catatan, s.waktu, S.me.Nama_Lengkap];
        });
        cachePut('mental', S.data.mental);
        S.boot.stat.mentalDone = Object.keys(S.data.mental).filter(k => S.data.mental[k][0] !== '' && S.data.mental[k][0] != null);
        cachePut('boot', S.boot);
        if (res.data.saved.length) toast('Nilai mental tersimpan', res.data.saved.length === 1 ? (R().peserta[res.data.saved[0].id] || {}).Nama_Lengkap || '' : res.data.saved.length + ' peserta diperbarui.');
        updateProgress();
      },
      onFail: res => toast('Gagal menyimpan', res.message + ' Draf tetap aman di perangkat ini.', 'error')
    });
  }

  function cur(pid) {
    if (saver && saver.has(pid)) return saver.get(pid);
    const s = savedOf(pid);
    return { n: s && s[0] !== '' && s[0] != null ? s[0] : '', c: s ? (s[1] || '') : '' };
  }
  function statusKey(pid) { const s = saver ? saver.state(pid) : ''; return s || (savedOf(pid) && savedOf(pid)[0] !== '' ? 'saved' : 'empty'); }
  function statusHtml(pid) { const s = saver ? saver.state(pid) : ''; const sv = savedOf(pid); return saveBadge(s, sv && sv[0] !== '' ? 1 : 0, saver && saver.errors[pid]); }
  function atHtml(pid) { const s = savedOf(pid); return s ? esc(fmt.ago(s[2])) : ''; }

  function onInput(pid) {
    const inp = el.querySelector('.grade-in[data-pid="' + CSS.escape(pid) + '"]'), note = el.querySelector('[data-note="' + CSS.escape(pid) + '"]');
    const p = parseGrade(inp.value);
    inp.classList.toggle('invalid', !!p.error);
    if (p.error) { saver.unset(pid); el.querySelector('[data-st="' + CSS.escape(pid) + '"]').innerHTML = saveBadge('invalid'); return; }
    const v = { n: p.empty ? '' : p.value, c: note.value.trim() }, s = savedOf(pid);
    const same = s ? String(s[0]) === String(v.n) && (s[1] || '') === v.c : v.n === '' && !v.c;
    if (same) saver.unset(pid); else saver.set(pid, v);
    inp.classList.toggle('dirty', saver.has(pid));
    updateProgress();
  }
  function updateRow(pid) {
    const sEl = el.querySelector('[data-st="' + CSS.escape(pid) + '"]');
    if (sEl) sEl.innerHTML = statusHtml(pid);
    const aEl = el.querySelector('[data-at="' + CSS.escape(pid) + '"]');
    if (aEl) aEl.innerHTML = atHtml(pid);
    const inp = el.querySelector('.grade-in[data-pid="' + CSS.escape(pid) + '"]'), note = el.querySelector('[data-note="' + CSS.escape(pid) + '"]');
    if (inp) {
      inp.classList.toggle('dirty', saver.has(pid));
      if (!saver.has(pid) && document.activeElement !== inp && document.activeElement !== note) {
        const c = cur(pid);
        inp.value = c.n === '' ? '' : String(c.n).replace('.', ','); note.value = c.c; inp.classList.remove('invalid');
      }
    }
    updateSaveState();
  }
  function updateSaveState() {
    const box = $('#mt-save-state', el), n = saver.count(), err = Object.keys(saver.errors).length;
    box.innerHTML = err ? '<span style="color:var(--red)">' + icon('alert-circle', 'sm') + ' ' + err + ' gagal disimpan</span>' :
      n ? icon('clock', 'sm') + ' ' + n + ' perubahan menunggu disimpan' : icon('check-circle', 'sm') + ' Semua perubahan tersimpan';
  }
  function pairOf(p) {
    const [k, pl] = st.pair.split('|');
    return !st.pair || (p.ID_Kelas === k && (!pl || p.ID_Peleton === pl));
  }
  function updateProgress() {
    const all = S.boot.peserta.filter(pairOf);
    const vals = all.map(p => cur(p.ID_Peserta).n).filter(v => v !== '' && v != null);
    $('#mt-prog-t', el).textContent = vals.length + '/' + all.length + ' (' + (all.length ? Math.round(vals.length / all.length * 100) : 0) + '%)';
    $('#mt-prog', el).style.width = (all.length ? vals.length / all.length * 100 : 0) + '%';
    const a = avg(vals);
    $('#mt-stats', el).innerHTML =
      stat({ label: 'Total Peserta Asuhan', value: all.length, unit: 'siswa', icon: 'users', cap: st.pair ? esc(pairLabel(st.pair)) : 'Semua peleton binaan' }) +
      stat({ label: 'Sudah Dinilai', value: vals.length, unit: 'siswa', icon: 'clipboard-check', cap: (all.length - vals.length) + ' peserta belum dinilai' }) +
      stat({ label: 'Rata-rata Skor', value: a == null ? '—' : fmt.num(a, 1), unit: a == null ? '' : '/ 100', icon: 'medal', cap: 'Dari peserta yang sudah dinilai' });
    updateSaveState();
  }
  function pairLabel(v) { const [k, p] = v.split('|'); return kelasName(k) + (p ? ' — ' + pelName(p) : ' (semua peleton)'); }
  function fillPairs() {
    const pairs = S.boot.scope.pairs.map(a => a.k + '|' + a.p);
    if (st.pair && pairs.indexOf(st.pair) === -1) st.pair = '';
    $('#mt-pair', el).innerHTML = (pairs.length > 1 ? '<option value="">Semua peleton binaan</option>' : '') + pairs.map(v => '<option value="' + esc(v) + '"' + (v === st.pair ? ' selected' : '') + '>' + esc(pairLabel(v)) + '</option>').join('');
    if (pairs.length === 1) st.pair = pairs[0];
  }
  function rows() {
    const q = norm(st.q);
    return S.boot.peserta.filter(p => {
      if (!pairOf(p)) return false;
      if (q && norm(p.Nama_Lengkap).indexOf(q) === -1 && String(p.NRP).indexOf(q) === -1) return false;
      const k = statusKey(p.ID_Peserta);
      if (st.status === 'empty' && k !== 'empty') return false;
      if (st.status === 'saved' && k !== 'saved') return false;
      if (st.status === 'draft' && ['draft', 'error', 'saving'].indexOf(k) === -1) return false;
      return true;
    });
  }
  function refresh(keepPage) {
    if (!S.boot.scope.pairs.length) { $('#mt-table', el).innerHTML = emptyState('layers', 'Belum ada penugasan', 'Akun Anda belum ditugaskan ke kelas/peleton. Hubungi Admin Satdik.'); return; }
    if (!S.data.mental) { $('#mt-table', el).innerHTML = loadErr ? errorState(loadErr) : skeletonRows(6, 4); updateProgress(); return; }
    table.set(rows(), keepPage);
  }
  function load(force) {
    loadErr = null;
    refresh();
    swr('mental', 'mentalList', {}, d => {
      S.data.mental = d.mental;
      const focused = el.contains(document.activeElement) && document.activeElement.matches('.grade-in, .note-in');
      if (focused) { $$('.grade-in', el).forEach(i => updateRow(i.dataset.pid)); updateProgress(); } else refresh(true);
    }, { fresh: force ? 0 : 30000, force, onError: res => { loadErr = res.message; refresh(); } });
  }
  return {
    title: 'Nilai Mental Kepribadian',
    roles: ['Pengasuh'],
    show(root, param, o) { if (o.isNew || !table) build(root); fillPairs(); load(false); },
    onBoot() { if (!el) return; fillPairs(); refresh(true); },
    leave() { if (saver && saver.count()) saver.flush(); }
  };
})();
page('mental', MentalPage);

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
      desc: isAdmin ? 'Ganti password akun Anda dan kelola logo aplikasi yang tampil di halaman login serta navigasi.' : 'Ganti password akun Anda secara berkala untuk menjaga keamanan data penilaian.'
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
        '<div class="card"><div class="card-head"><div class="icon-tile">' + icon('image') + '</div><div class="grow"><h3>Logo Aplikasi</h3><div class="sub">Tampil di halaman login dan navigasi</div></div>' + roleBadge('Admin') + '</div>' +
          '<div class="card-body"><div class="row" style="align-items:flex-start;gap:20px">' +
            '<div><div class="label-mono" style="margin-bottom:8px">Logo saat ini</div><div class="logo-preview" id="lg-cur">' + (set.logoUrl ? '<img src="' + esc(set.logoUrl) + '" alt="Logo aplikasi" referrerpolicy="no-referrer">' : icon('shield-star', 'lg') ) + '</div></div>' +
            '<div class="grow" style="min-width:220px"><div class="label-mono" style="margin-bottom:8px">Unggah pengganti</div>' +
              '<label class="drop" id="lg-drop"><input type="file" id="lg-file" accept="image/png,image/jpeg" hidden><div class="icon-tile">' + icon('cloud-up') + '</div><b>Pilih berkas atau seret logo ke sini</b><div class="hint mt-8">PNG atau JPG, maksimal 2 MB. Disarankan persegi (1:1).</div></label>' +
              '<div id="lg-msg" class="mt-8"></div>' +
              '<div class="row mt-16"><button class="btn primary" id="lg-save" disabled>' + icon('upload') + 'Simpan Logo</button></div>' +
            '</div></div></div></div>'
        :
        '<div class="card"><div class="card-head"><div class="icon-tile">' + icon('user') + '</div><div class="grow"><h3>Informasi Akun</h3><div class="sub">Diatur oleh Admin Satdik</div></div>' + roleBadge(me.Role) + '</div>' +
          '<div class="card-body"><dl class="kv"><dt>Nama</dt><dd>' + esc(me.Nama_Lengkap) + '</dd><dt>Username</dt><dd class="mono">' + esc(me.Username) + '</dd>' +
          (me.Pangkat ? '<dt>Pangkat</dt><dd>' + esc(me.Pangkat) + '</dd>' : '') + (me.NRP ? '<dt>NRP/NIP</dt><dd class="mono">' + esc(me.NRP) + '</dd>' : '') +
          '<dt>Penugasan</dt><dd>' + (asg.length ? asg.map(esc).join('<br>') : '—') + '</dd></dl></div></div>') +
    '</div>' +
    (isAdmin ? '<div class="card mt-24"><div class="card-head"><div class="icon-tile">' + icon('database') + '</div><div class="grow"><h3>Pemeliharaan Sistem</h3><div class="sub">Berjalan otomatis di server Apps Script</div></div></div><div class="card-body"><div class="grid c3">' +
      '<div><div class="label-mono">Cadangan harian</div><p class="mt-8">Salinan database dibuat otomatis setiap pukul 02.00 WIT ke folder <b>Cadangan Harian</b> di Google Drive (14 salinan terakhir disimpan).</p></div>' +
      '<div><div class="label-mono">Log aktivitas</div><p class="mt-8">Perubahan nilai, akun, dan jadwal dicatat dan ditulis ke sheet <b>Log_Aktivitas</b> setiap menit.</p></div>' +
      '<div><div class="label-mono">Versi</div><p class="mt-8"><span class="mono">SIPL ' + esc(set.version || '1.0.0') + '</span> • Server Google Apps Script • Database Google Sheets</p></div>' +
      '</div></div></div>' : '');

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
  const drop = $('#lg-drop', el), file = $('#lg-file', el), msg = $('#lg-msg', el), save = $('#lg-save', el);
  const pick = f => {
    picked = null; save.disabled = true; msg.innerHTML = '';
    if (!f) return;
    if (['image/png', 'image/jpeg'].indexOf(f.type) === -1) { msg.innerHTML = '<div class="alert red">' + icon('alert-circle') + '<div>Format tidak didukung. Gunakan PNG atau JPG.</div></div>'; return; }
    if (f.size > 2 * 1024 * 1024) { msg.innerHTML = '<div class="alert red">' + icon('alert-circle') + '<div>Ukuran ' + fmt.num(f.size / 1048576, 1) + ' MB melebihi batas 2 MB.</div></div>'; return; }
    picked = f;
    const url = URL.createObjectURL(f);
    msg.innerHTML = '<div class="alert green">' + icon('check-circle') + '<div><b>' + esc(f.name) + '</b> • ' + fmt.num(f.size / 1024, 0) + ' KB — siap diunggah.</div></div>';
    $('#lg-cur', el).innerHTML = '<img src="' + url + '" alt="Pratinjau logo">';
    save.disabled = false;
  };
  file.onchange = () => pick(file.files[0]);
  ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => pick(e.dataTransfer.files[0]));
  save.onclick = async () => {
    if (!picked) return;
    const done = busy(save, 'Mengunggah…');
    const b64 = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(picked); });
    const res = await api('logoUpload', { mime: picked.type, base64: b64, name: picked.name });
    done();
    if (!res.success) { msg.innerHTML = '<div class="alert red">' + icon('alert-circle') + '<div>' + esc(res.message) + '</div></div>'; return; }
    S.boot.settings = res.data.settings;
    Store.set('public', { appName: res.data.settings.appName, logoUrl: res.data.settings.logoUrl });
    bootChanged();
    applyBranding();
    toast('Logo diperbarui', 'Logo baru tampil di navigasi dan halaman login.');
  };
}
