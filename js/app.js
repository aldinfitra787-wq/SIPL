/* ==========================================================================
   SIPL — Inisialisasi aplikasi: login, sesi, navigasi per peran, prefetch
   ========================================================================== */

const NAV = {
  Admin: [
    ['Navigasi Utama', [['dashboard', 'grid', 'Dashboard'], ['peserta', 'cap', 'Peserta Pelatihan'], ['personel', 'id-card', 'Personel & Akun', 'ADMIN'], ['master', 'database', 'Master Data', 'ADMIN'], ['jadwal', 'calendar', 'Jadwal Pelajaran']]],
    ['Penilaian', [['rekap', 'table', 'Rekap Harian'], ['rekap-akhir', 'medal', 'Rekap Akhir']]],
    ['Sistem', [['migrasi', 'import', 'Migrasi Data'], ['pengaturan', 'settings', 'Pengaturan']]]
  ],
  Gadik: [
    ['Navigasi Utama', [['dashboard', 'grid', 'Dashboard'], ['peserta', 'cap', 'Peserta Pelatihan'], ['jadwal', 'calendar', 'Jadwal Pelajaran']]],
    ['Penilaian', [['nilai', 'pen', 'Input Nilai Harian'], ['rekap-akhir', 'medal', 'Rekap Akhir']]],
    ['Akun', [['pengaturan', 'settings', 'Pengaturan']]]
  ]
};

const IDLE_MS = (Number(CFG.IDLE_MINUTES) || 60) * 60000;
let lastAct = Date.now(), ending = false, hiddenAt = 0;

// --------------------------------------------------------------------------
// Branding (logo & nama dari server, disimpan lokal untuk tampil instan)
// --------------------------------------------------------------------------
// Urutan logo: (1) logo yang diunggah Admin di Pengaturan — disimpan di database & di-cache per versi,
// (2) CFG.LOGO di js/config.js (berkas di repo, mis. img/logo.png), (3) ikon perisai bawaan.
const _logoTried = {};
function brandInfo() { return (S.boot && S.boot.settings) || Store.get('public', {}) || {}; }
function currentLogo() {
  const s = brandInfo(), c = Store.get('logo', null);
  if (s.logoVer) {
    if (c && c.ver === s.logoVer && c.data) return c.data;
    fetchLogo(s.logoVer);
    if (c && c.data) return c.data;                       // tampilkan logo sebelumnya sambil memuat yang baru
  } else if (c && s.appName) Store.del('logo');           // logo sudah dikembalikan ke bawaan
  if (s.logoUrl) return s.logoUrl;                        // logo lama via Google Drive (v1.0–1.2)
  return CFG.LOGO || '';
}
function fetchLogo(ver) {
  if (_logoTried[ver] || !isConfigured()) return;
  _logoTried[ver] = 1;
  fetch(GAS_URL + '?action=logo&v=' + encodeURIComponent(ver), { cache: 'no-store' })
    .then(r => r.json())
    .then(j => { if (j && j.success && j.data.data) { Store.set('logo', j.data); applyBranding(); } })
    .catch(() => {});
}
let _favDefault = null;
function applyBranding() {
  const url = currentLogo();
  const img = alt => '<img src="' + esc(url) + '" alt="' + alt + '" referrerpolicy="no-referrer" onerror="this.replaceWith(document.createRange().createContextualFragment(icon(\'shield-star\')))">';
  const brand = $('#brand-logo'), login = $('#login-logo');
  if (brand) brand.innerHTML = url ? img('Logo SIPL') : icon('shield-star');
  if (login) login.innerHTML = url ? img('Logo SPN Polda Papua Barat') : icon('shield-star');
  const emb = $('#login-emblem');
  if (emb) emb.innerHTML = url ? img('Logo') : icon('shield-star');
  const lp = $('#lp-logo');
  if (lp) lp.innerHTML = url ? img('Logo') : icon('shield-star');
  const fav = document.querySelector('link[rel="icon"]');
  if (fav) { if (_favDefault === null) _favDefault = fav.href; fav.href = url || _favDefault; }
}

// --------------------------------------------------------------------------
// Login
// --------------------------------------------------------------------------
function showLogin(msg) {
  $('#boot').hidden = true;
  $('#shell').hidden = true;
  $('#login').hidden = false;
  applyBranding();
  const box = $('#login-error');
  if (msg) { box.hidden = false; box.innerHTML = icon('info') + '<div>' + esc(msg) + '</div>'; }
  if (!isConfigured()) {
    const c = $('#login-config');
    c.hidden = false;
    c.innerHTML = icon('alert-triangle') + '<div><b>Server belum dihubungkan.</b> Isi <span class="mono">GAS_URL</span> di berkas <span class="mono">js/config.js</span> dengan URL Web App (/exec) dari Apps Script.</div>';
  }
  setTimeout(() => { const u = $('#lg-user'); if (u && !u.value) u.focus(); }, 50);
  setTimeout(siapkanAdmin, 1200);
  const pw = $('#lg-pass');
  if (pw && !pw._warm) { pw._warm = 1; pw.addEventListener('focus', () => { if (Date.now() - (S._warmAt || 0) > 60000) { S._warmAt = Date.now(); warmUp(); } }); }
  fetchPublicInfo().then(info => {
    if (!info) return;
    Store.set('public', { appName: info.appName, logoUrl: info.logoUrl, logoVer: info.logoVer || '' });
    applyBranding();
    if (info.setup === false) {
      const c = $('#login-config');
      c.hidden = false;
      c.innerHTML = icon('alert-triangle') + '<div><b>Database belum di-setup.</b> Jalankan fungsi <span class="mono">setupAppEnvironment()</span> di editor Apps Script.</div>';
    }
  });
}

// --------------------------------------------------------------------------
// Progres masuk: layar login diburamkan, logo + persentase 0–100%
// --------------------------------------------------------------------------
const LoginProgress = (() => {
  const KELILING = 2 * Math.PI * 54;              // keliling cincin SVG (r = 54)
  let el, cur = 0, target = 0, cap = 0, rid = 0, t0 = 0, last = 0, jalan = false;
  const q = id => $('#' + id);
  function paint() {
    const v = Math.round(cur);
    q('lp-num').textContent = v;
    q('lp-bar').style.width = cur.toFixed(1) + '%';
    q('lp-ring').style.strokeDashoffset = (KELILING * (1 - cur / 100)).toFixed(2);
    el.setAttribute('aria-valuenow', v);
  }
  function tick(now) {
    if (!jalan) return;
    const dt = Math.min(64, now - (last || now)); last = now;
    // merayap pelan menuju batas tahap saat menunggu server, lalu mengejar target dengan halus
    if (cap > target) target = Math.min(cap, target + (cap - target) * dt / 900);
    cur += (target - cur) * Math.min(1, dt / (GERAK ? 45 : 1));
    if (Math.abs(target - cur) < 0.05) cur = target;
    paint();
    rid = raf(tick);
  }
  function step(pct, label, crawlTo) {
    target = Math.max(target, pct); cap = Math.max(target, crawlTo || 0);
    if (label) { const st = q('lp-step'); if (st.textContent !== label) { st.textContent = label; st.classList.remove('swap'); void st.offsetWidth; st.classList.add('swap'); } }
  }
  /** Tunggu sampai angka benar-benar mencapai `pct` (agar 100% terlihat sebelum berpindah layar). */
  function reach(pct) {
    return new Promise(ok => { const chk = () => (cur >= pct - 0.5 ? ok() : setTimeout(chk, 40)); chk(); });
  }
  return {
    show() {
      el = q('login-progress');
      cur = target = cap = 0; last = 0; t0 = Date.now(); paint();
      el.hidden = false; el.classList.remove('out');
      $('#login').classList.add('is-loading');
      raf(() => el.classList.add('on'));
      if (!jalan) { jalan = true; rid = raf(tick); }
    },
    step,
    async finish(label) {
      step(100, label);
      await reach(100);                     // ± 0,15 detik: angka mengejar 100% lalu langsung masuk
      await new Promise(r => setTimeout(r, GERAK ? 90 : 0));
    },
    hide(keepLogin) {
      if (!el) return;
      jalan = false;
      el.classList.add('out'); el.classList.remove('on');
      if (!keepLogin) $('#login').classList.remove('is-loading');
      setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, GERAK ? 420 : 0);
    }
  };
})();

// Modul admin diunduh lebih dulu ke cache browser selagi halaman login terbuka (tidak dijalankan),
// sehingga setelah server menjawab, modul langsung tersedia tanpa jeda tambahan.
let _adminPrefetch = false;
function siapkanAdmin() {
  if (_adminPrefetch || window.ADMIN_READY) return;
  _adminPrefetch = true;
  try { const l = document.createElement('link'); l.rel = 'prefetch'; l.as = 'script'; l.href = 'js/admin.js?v=' + FE_VERSION; document.head.appendChild(l); } catch (e) { /* abaikan */ }
}

async function doLogin(e) {
  e.preventDefault();
  const box = $('#login-error'), user = $('#lg-user'), pass = $('#lg-pass');
  box.hidden = true;
  if (!user.value.trim() || !pass.value) {
    box.hidden = false; box.innerHTML = icon('alert-triangle') + '<div>Isi username dan password terlebih dahulu.</div>';
    (user.value.trim() ? pass : user).focus();
    return;
  }
  const done = busy($('#lg-submit'), 'Memverifikasi…');
  const fokus = document.activeElement; if (fokus && fokus.blur) fokus.blur();   // tutup keyboard di HP
  LoginProgress.show();
  LoginProgress.step(12, 'Menghubungkan ke server SIPL…', 40);
  const tVer = setTimeout(() => LoginProgress.step(30, 'Memverifikasi akun & kata sandi…', 82), 160);
  const res = await api('login', { username: user.value.trim(), password: pass.value }, { tries: 2 });
  clearTimeout(tVer);
  if (!res.success) {
    LoginProgress.hide();
    done();
    box.hidden = false;
    box.innerHTML = icon('alert-triangle') + '<div>' + esc(res.message || 'Gagal masuk.') + '</div>';
    pass.value = ''; pass.focus();
    return;
  }
  const boot = res.data.boot;
  LoginProgress.step(84, 'Akun terverifikasi • menyiapkan data ' + (boot.me.Role === 'Admin' ? 'satuan pendidikan' : 'kelas Anda') + '…', 94);
  S.token = res.data.token; S.uid = boot.me.ID_User; S.role = boot.me.Role;
  Store.set('session', { token: S.token, uid: S.uid, role: S.role, t: Date.now(), act: Date.now() });
  pass.value = '';
  lastAct = Date.now();
  if (boot.me.Role === 'Admin' && !window.ADMIN_READY) {
    try { await loadScript('js/admin.js'); } catch (err) { /* startApp memberi tahu bila gagal */ }
  }
  const nama = String(boot.me.Nama_Lengkap || '').split(',')[0];
  await LoginProgress.finish('Selamat datang, ' + nama);
  done();
  startApp(boot); S._versiCek = true; setTimeout(cekVersiServer, 1500);
  LoginProgress.hide(true);
}

// --------------------------------------------------------------------------
// Shell aplikasi
// --------------------------------------------------------------------------
function loadScript(src) {
  return new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = src + '?v=' + FE_VERSION;
    s.onload = ok; s.onerror = no;
    document.head.appendChild(s);
  });
}

function buildNav() {
  const groups = NAV[S.role] || NAV.Gadik;
  $('#nav').innerHTML = groups.map(g =>
    '<div class="nav-label">' + esc(g[0]) + '</div>' +
    g[1].map(i => '<a href="#/' + i[0] + '" data-nav="' + i[0] + '">' + icon(i[1]) + '<span>' + esc(i[2]) + '</span>' + (i[3] ? '<span class="tag">' + i[3] + '</span>' : '') + '</a>').join('')
  ).join('');
}
function setActiveNav(name) {
  const alias = { akun: 'personel', 'impor-gadik': 'personel', 'impor-peserta': 'peserta' };
  const n = alias[name] || name;
  $$('#nav a').forEach(a => { const on = a.dataset.nav === n; a.classList.toggle('active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $('#shell').classList.remove('nav-open');
}
Bus.on('route', setActiveNav);

function fillUser() {
  const me = S.me, ini = initials(me.Nama_Lengkap), foto = fotoData(me.ID_User, me.Foto_Ver);
  ['#side-avatar', '#top-avatar'].forEach(sel => {
    const av = $(sel); if (!av) return;
    av.dataset.foto = me.ID_User; av.dataset.ini = ini;
    av.classList.toggle('has-foto', !!foto);
    av.innerHTML = foto ? '<img src="' + foto + '" alt="" decoding="async">' : esc(ini);
  });
  $('#side-name').textContent = me.Nama_Lengkap;
  $('#side-sub').textContent = me.NRP ? 'NRP ' + me.NRP : '@' + me.Username;
  $('#top-name').textContent = me.Nama_Lengkap;
  $('#top-sub').innerHTML = roleBadge(me.Role) + (me.Pangkat ? '<span>' + esc(me.Pangkat) + '</span>' : '');
}

function startApp(boot) {
  S.boot = boot; S.me = boot.me; S.role = boot.me.Role; S.uid = boot.me.ID_User;
  S.boot.stat = S.boot.stat || {};
  bootChanged();
  $('#boot').hidden = true; $('#login').hidden = true; $('#shell').hidden = false;
  buildNav(); fillUser(); applyBranding();
  Store.set('public', { appName: boot.settings.appName, logoUrl: boot.settings.logoUrl, logoVer: boot.settings.logoVer || '' });
  const begin = () => {
    if (!location.hash || location.hash === '#/' || location.hash === '#') history.replaceState(null, '', '#/dashboard');
    route();
    // Prefetch saat browser senggang (requestIdleCallback butuh objek opsi, bukan angka)
    setTimeout(() => { if (window.requestIdleCallback) window.requestIdleCallback(() => prefetch(), { timeout: 3000 }); else prefetch(); }, 1200);
  };
  if (S.role === 'Admin' && !window.ADMIN_READY) loadScript('js/admin.js').then(begin, () => { toast('Modul admin gagal dimuat', 'Periksa koneksi lalu muat ulang halaman.', 'error'); begin(); });
  else begin();
}

/** Segarkan data layar pertama di latar (cache tetap tampil lebih dulu). */
async function revalidate() {
  const res = await api('bootstrap', {});
  if (!res.success) return;
  const roleChanged = res.data.me.Role !== S.role;
  S.boot = res.data; S.me = res.data.me;
  if (roleChanged) { Store.set('session', Object.assign(Store.get('session', {}), { role: S.me.Role })); location.reload(); return; }
  bootChanged(); fillUser(); applyBranding();
  if (!S._versiCek) { S._versiCek = true; cekVersiServer(); }
}

/** Peringatkan bila backend (Kode.gs) lebih lama dari tampilan — penyebab umum error setelah pembaruan. */
function cekVersiServer() {
  const sv = String((S.boot && S.boot.settings && S.boot.settings.version) || ''), num = v => v.split('.').slice(0, 2).map(Number);
  if (!sv) return;
  const [a, b] = num(sv), [c, d] = num(FE_VERSION);
  if (a < c || (a === c && b < d)) {
    console.warn('Server SIPL ' + sv + ' lebih lama dari tampilan ' + FE_VERSION);
    if (S.role === 'Admin') toast('Server belum diperbarui', 'Server masih versi ' + sv + ', tampilan versi ' + FE_VERSION + '. Tempel Kode.gs & Migrasi.gs terbaru di Apps Script lalu Terapkan → Kelola deployment → Edit → Versi baru.', 'warning');
  }
}

/** Prefetch data menu yang sering dibuka dalam SATU panggilan batch saat idle. */
async function prefetch() {
  let calls = [];
  if (S.role === 'Admin') calls = [{ action: 'usersList' }];
  else if (S.role === 'Gadik') {
    // Sesi mengajar hari ini → siapkan data input nilai harian
    const t = todayStr();
    if (S.boot.jadwal.some(j => j.ID_Gadik === S.me.ID_Gadik && jadwalAktif(j, t))) calls = [{ action: 'nilaiHarian', data: { tanggal: t } }];
  }
  calls = calls.filter(c => {
    const key = c.action === 'usersList' ? 'users' : 'harian:' + c.data.tanggal;
    const cur = Store.get(uk(key), null);
    return !cur || Date.now() - cur.t > 60000;
  });
  if (!calls.length) return;
  const res = await api('batch', { calls });
  if (!res.success) return;
  const r = res.data;
  if (r.usersList && r.usersList.success) { cachePut('users', r.usersList.data); if (!S.data.users) S.data.users = r.usersList.data; }
  if (r.nilaiHarian && r.nilaiHarian.success && harianValid(r.nilaiHarian.data)) cachePut('harian:' + r.nilaiHarian.data.tanggal, r.nilaiHarian.data);
}

// --------------------------------------------------------------------------
// Sesi: keluar, kedaluwarsa, idle 60 menit
// --------------------------------------------------------------------------
function endSession(msg, keepCache) {
  if (ending) return;
  ending = true;
  if (!keepCache && S.uid) Store.dropUser(S.uid);
  Store.del('session');
  try { if (msg) sessionStorage.setItem('sipl:msg', msg); } catch (e) { /* abaikan */ }
  location.replace(location.pathname + location.search);
}

async function logout() {
  const n = pendingDrafts();
  if (n) {
    const ok = await confirmBox({ title: 'Ada perubahan belum tersimpan', icon: 'alert-triangle', okText: 'Simpan & keluar', text: n + ' nilai belum tersimpan ke server. Simpan dulu sebelum keluar?' });
    if (!ok) return;
    await flushAllSavers();
    if (pendingDrafts()) { toast('Belum bisa keluar', 'Sebagian nilai gagal disimpan. Periksa koneksi lalu coba lagi.', 'error'); return; }
  } else if (!(await confirmBox({ title: 'Keluar dari SIPL?', icon: 'logout', okText: 'Keluar', text: 'Anda perlu memasukkan username dan password lagi untuk masuk.' }))) return;
  await Promise.race([api('logout', {}, { tries: 1 }), new Promise(r => setTimeout(r, 2500))]);
  endSession('Anda telah keluar dari SIPL.');
}

Bus.on('auth:expired', msg => endSession(msg || 'Sesi Anda telah berakhir. Silakan masuk kembali.', true));

function markActive() {
  lastAct = Date.now();
}
['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(ev => window.addEventListener(ev, markActive, { passive: true }));
setInterval(() => {
  if (!S.token) return;
  if (Date.now() - lastAct > IDLE_MS) { flushAllSavers(); endSession('Sesi berakhir karena tidak ada aktivitas selama ' + Math.round(IDLE_MS / 60000) + ' menit.', true); return; }
  const s = Store.get('session', null);
  if (s && Math.abs((s.act || 0) - lastAct) > 60000) Store.set('session', Object.assign(s, { act: lastAct }));
}, 30000);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now();
    const s = Store.get('session', null);
    if (s) Store.set('session', Object.assign(s, { act: lastAct }));
  } else if (S.token && hiddenAt && Date.now() - hiddenAt > 120000) {
    if (Date.now() - lastAct > IDLE_MS) return endSession('Sesi berakhir karena tidak ada aktivitas selama ' + Math.round(IDLE_MS / 60000) + ' menit.', true);
    warmUp();
    revalidate();
  }
});

function updateNet() { $('#net-status').classList.toggle('show', navigator.onLine === false); }
window.addEventListener('online', () => { updateNet(); toast('Kembali online', 'Perubahan yang tertunda sedang dikirim.', 'info'); });
window.addEventListener('offline', () => { updateNet(); toast('Koneksi terputus', 'Nilai yang Anda ketik tetap aman di perangkat ini dan dikirim saat online.', 'warning'); });

// --------------------------------------------------------------------------
// Mulai
// --------------------------------------------------------------------------
// Service worker: kunjungan berikutnya membuka aplikasi seketika dari cache perangkat (lihat sw.js).
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && (!navigator.webdriver || /[?&]sw=1/.test(location.search))) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

(function init() {
  hydrateIcons(document);
  $('#login-year').textContent = new Date().getFullYear();
  $('#login-form').addEventListener('submit', doLogin);
  bindEye($('#lg-eye'), $('#lg-pass'));
  $('#btn-logout').onclick = logout;
  $('#btn-menu').onclick = () => $('#shell').classList.toggle('nav-open');
  $('#scrim').onclick = () => $('#shell').classList.remove('nav-open');
  window.addEventListener('hashchange', route);
  updateNet();
  applyBranding();

  let msg = '';
  try { msg = sessionStorage.getItem('sipl:msg') || ''; sessionStorage.removeItem('sipl:msg'); } catch (e) { /* abaikan */ }

  const sess = Store.get('session', null);
  if (!sess || !sess.token || !sess.uid) { warmUp(); return showLogin(msg); }
  if (sess.act && Date.now() - sess.act > IDLE_MS) {
    Store.del('session');
    warmUp();
    return showLogin('Sesi berakhir karena tidak ada aktivitas selama ' + Math.round(IDLE_MS / 60000) + ' menit.');
  }
  if (!NAV[sess.role]) {                         // peran lama yang sudah dihapus (mis. Pengasuh, v1.7)
    Store.dropUser(sess.uid); Store.del('session');
    warmUp();
    return showLogin('Peran akun ini sudah tidak digunakan di SIPL. Hubungi Admin Satdik.');
  }
  S.token = sess.token; S.uid = sess.uid; S.role = sess.role;
  lastAct = Date.now();
  const cached = cacheGet('boot');
  if (cached && cached.me && cached.me.ID_User === sess.uid) {
    startApp(cached);          // tampil instan dari cache perangkat
    revalidate();              // lalu segarkan di latar
  } else {
    api('bootstrap', {}).then(res => {
      if (res.success) { startApp(res.data); S._versiCek = true; setTimeout(cekVersiServer, 1500); }
      else if (res.code !== 'AUTH') showLogin(res.message);
    });
  }
})();
