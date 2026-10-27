// Offline shell for the Mandir Tour Program. Program data is never cached here
// (it comes from the database and is kept on the device by the page after sign-in).
const CACHE = 'mandir-tour-v41';
const SHELL = ['./', './index.html', './manifest.webmanifest', './tithi-l.json', './tithi-i-2026.json', './tithi-i-2027.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './katha-sticker.webp', './vastu-sticker.webp', './aarti-sticker.webp', './padramani-sticker.webp', './pravachan-sticker.webp'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fonts: show cached copy now, refresh in the background.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(CACHE).then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((r) => { c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })));
    return;
  }

  if (url.origin !== location.origin) return; // database calls etc. go straight to the network

  // Own files: try the network first so updates arrive, fall back to the saved copy offline.
  e.respondWith(
    fetch(req)
      .then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return r; })
      .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});

// Reminder notifications. "before" = 5 minutes ahead; "start" = the event is beginning.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Event starting soon', body: e.data ? e.data.text() : '' }; }
  const start = d.kind === 'start';
  const opts = {
    body: d.body || '',
    tag: d.tag || undefined,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    vibrate: start ? [300, 120, 300, 120, 600] : [200, 100, 200],
    requireInteraction: start,
    data: { url: d.url || './' }
  };
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.title || 'Event starting soon', opts),
    // If the app is open on screen, ask it to speak the message aloud.
    d.speak ? self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      list.forEach((c) => c.postMessage({ type: 'speak', text: d.speak }));
    }) : null
  ]));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if (c.url.startsWith(self.registration.scope) && 'focus' in c) return c.focus(); }
    return self.clients.openWindow(target);
  }));
});
