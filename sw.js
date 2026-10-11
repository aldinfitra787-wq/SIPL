/* SIPL — Service worker (v1.9): membuka aplikasi seketika dari cache perangkat.
   - index.html & js/config.js : jaringan dulu (maks. 2,5 detik), cadangan dari cache → perubahan selalu terbaca.
   - berkas ber-versi (?v=…)     : cache dulu → tanpa unduh ulang.
   - gambar                      : cache lalu diperbarui di latar.
   - permintaan ke server Apps Script (lain domain) TIDAK disentuh. */
const VERSI = '1.9.0';
const CACHE = 'sipl-' + VERSI;
const INTI = ['./', 'index.html', 'js/config.js?v=' + VERSI,
  'css/style.css?v=' + VERSI, 'js/icons.js?v=' + VERSI, 'js/core.js?v=' + VERSI, 'js/ui.js?v=' + VERSI,
  'js/pages.js?v=' + VERSI, 'js/app.js?v=' + VERSI, 'js/admin.js?v=' + VERSI, 'js/export.js?v=' + VERSI, 'img/login-banner.jpg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(INTI.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.indexOf('sipl-') === 0 && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function jaringanDulu(req, ms) {
  return caches.open(CACHE).then(c => new Promise(resolve => {
    let selesai = false;
    const cadangan = () => c.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? c.match('index.html') : null));
    const t = setTimeout(() => cadangan().then(r => { if (r && !selesai) { selesai = true; resolve(r); } }), ms);
    fetch(req).then(res => {
      if (res && res.ok) c.put(req, res.clone());
      clearTimeout(t);
      if (!selesai) { selesai = true; resolve(res); }
    }).catch(() => { clearTimeout(t); cadangan().then(r => { if (!selesai) { selesai = true; resolve(r || Response.error()); } }); });
  }));
}
function cacheDulu(req) {
  return caches.open(CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => { if (res && res.ok) c.put(req, res.clone()); return res; })));
}
function cacheLaluPerbarui(req) {
  return caches.open(CACHE).then(c => c.match(req).then(hit => {
    const baru = fetch(req).then(res => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || baru;
  }));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;              // Apps Script, Google Fonts, dll. → langsung ke jaringan
  if (url.pathname.endsWith('/sw.js')) return;
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/config.js')) {
    e.respondWith(jaringanDulu(req, 2500));
  } else if (/[?&]v=/.test(url.search)) {
    e.respondWith(cacheDulu(req));
  } else if (/\.(jpg|jpeg|png|webp|svg|ico)$/i.test(url.pathname)) {
    e.respondWith(cacheLaluPerbarui(req));
  }
});
