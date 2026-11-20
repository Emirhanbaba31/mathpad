// Offline cache for the web/PWA version (the desktop app serves files locally and does not use this).
// Bump VERSION when app files change so installed copies update.
const VERSION = 'mathpad-v24';
const CORE = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest',
  'js/app.js', 'js/db.js', 'js/ui.js', 'js/board.js', 'js/tools.js', 'js/fx.js', 'js/astro.js', 'js/sky.js', 'js/badges.js', 'js/shapes.js', 'js/symbols.js', 'js/sync.js', 'js/update.js', 'js/solar.js', 'js/solar3d.js', 'vendor/three.mjs', 'css/solar.css', 'js/planets.js', 'css/planets.css', 'js/merge.js', 'js/sim.js', 'js/simcore.js', 'css/sim.css', 'vendor/anthropic.mjs',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'vendor/math.js', 'vendor/katex/katex.min.js', 'vendor/katex/katex.min.css', 'vendor/fonts/fonts.css',
  'vendor/pdf.min.js', 'vendor/pdf.worker.min.js', 'vendor/jspdf.umd.min.js',
];

self.addEventListener('install', e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())));

// Stale-while-revalidate: answer from cache instantly, refresh in background (fonts are cached on first use).
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit || Response.error());
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  }));
});
