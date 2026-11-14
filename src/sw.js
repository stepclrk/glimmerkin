/* ===== The offline copy. Hosted site only =====
   A service worker that keeps a copy of the game page on the device, so the game opens with no connection.
   Not part of the page: build.sh copies it beside the page and the server answers it at /sw.js.
   The page always comes from the server when the server answers; the copy is only for when it cannot be reached.
   Anything else the page asks for (the account, saves, /build.json) goes straight to the server as before. */
const CACHE = 'glimmerkin-offline-1';
const GAME = '/play';
const FONTS = ['https://fonts.googleapis.com/', 'https://fonts.gstatic.com/'];
const PATIENCE = 6000;   // how long a slow connection is given before the kept copy is shown instead

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.add(new Request(GAME, { cache: 'no-cache' }))).catch(() => { }));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('glimmerkin-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname === GAME) e.respondWith(game(req, e));
  else if (FONTS.some(f => req.url.startsWith(f))) e.respondWith(font(req));
});

// The server's page when it answers, kept for next time. Its own copy when the server is out of reach, is
// answering with an error (a tunnel that is down answers 502), or is too slow.
async function game(req, e) {
  const cache = await caches.open(CACHE), kept = await cache.match(GAME);
  const net = fetch(req).then(async res => {
    if (res.status >= 500 && kept) return kept;
    if (res.ok && !res.redirected) await cache.put(GAME, res.clone());
    return res;
  });
  if (!kept) return net;
  const safe = net.catch(() => kept);
  e.waitUntil(safe);
  return Promise.race([safe, new Promise(r => setTimeout(() => r(kept), PATIENCE))]);
}
// The typefaces never change at an address, so a kept one is used straight away.
async function font(req) {
  const cache = await caches.open(CACHE), kept = await cache.match(req);
  if (kept) return kept;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') await cache.put(req, res.clone()).catch(() => { });
  return res;
}
