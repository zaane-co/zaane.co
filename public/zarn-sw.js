// ZARN service worker: makes ZARN installable and shows a friendly screen when offline.
// Pages and data always come fresh from the network (chat must never show stale messages).
const CACHE = 'zarn-v1';
const OFFLINE = '/zarn-offline.html';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([OFFLINE, '/zarn-icons/icon-192.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== 'zarn-nav').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)));
});

// Push: show the notification and put the unread count on the app icon. Skipped when ZARN is already open and visible (the app plays its own chime).
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) {}
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.some(w => w.visibilityState === 'visible')) return;
    if (self.navigator.setAppBadge && d.unread) { try { await self.navigator.setAppBadge(d.unread); } catch (_) {} }
    await self.registration.showNotification(d.title || 'ZARN', {
      body: d.body || '', tag: d.tag, icon: '/zarn-icons/icon-192.png', badge: '/zarn-icons/icon-192.png',
      data: { url: d.url || '/zarn', channel: d.channel }, renotify: true,
      requireInteraction: !!d.call, vibrate: d.call ? [300, 150, 300, 150, 300] : undefined,
    });
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/zarn';
  e.waitUntil((async () => {
    // Remember where to go: on iPhone a closed app always opens at its home page, so the app reads this when it starts.
    try { const c = await caches.open('zarn-nav'); await c.put('/__nav', new Response(JSON.stringify({ url, at: Date.now() }))); } catch (_) {}
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const w = wins.find(c => c.url.includes('/zarn'));
    if (w) { try { await w.focus(); } catch (_) {} w.postMessage({ type: 'zarn-open', url }); return; }
    await self.clients.openWindow(url);
  })());
});
