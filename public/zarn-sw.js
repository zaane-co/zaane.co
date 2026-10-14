// ZARN service worker: makes ZARN installable and shows a friendly screen when offline.
// Pages and data always come fresh from the network (chat must never show stale messages).
const CACHE = 'zarn-v1';
const OFFLINE = '/zarn-offline.html';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([OFFLINE, '/zarn-icons/icon-192.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)));
});
