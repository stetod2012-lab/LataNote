/* LataNote service worker: makes the app load instantly and work offline. */
const VERSION = 'latanote-v4';
const CORE = [
  './', 'index.html', 'app.html', 'manifest.webmanifest',
  'css/base.css', 'css/site.css', 'css/app.css',
  'js/core.js', 'js/paper.js', 'js/ink.js', 'js/editor.js', 'js/library.js', 'js/audio.js', 'js/planner.js', 'js/study.js', 'js/extras.js', 'js/collab.js', 'js/app.js',
  'assets/logo.svg', 'assets/icon-192.png', 'assets/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // app files: network first (so updates arrive), falling back to cache when offline
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('app.html')))
    );
    return;
  }
  // fonts: cache first
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })));
  }
});
