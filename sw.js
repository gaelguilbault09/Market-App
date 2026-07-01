const CACHE = 'marches-v1';
const FILES = ['./index.html', './manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});

// Reçoit un ordre de la page pour afficher une notification
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SHOW_NOTIF') {
    const { title, body } = e.data;
    self.registration.showNotification(title, {
      body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: 'briefing-marche',
      renotify: true,
      vibrate: [100, 50, 100],
    });
  }
});

// Réouvre/focus l'app au clic sur la notification
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientsArr) => {
      const existing = clientsArr.find((c) => c.url.includes('index.html'));
      if (existing) return existing.focus();
      return self.clients.openWindow('./index.html');
    })
  );
});

// Vérifie les heures de briefing même quand l'app n'est pas au premier plan
// (fonctionne tant que le service worker reste actif — voir limitations dans le README)
async function checkBriefingTime() {
  const now = new Date();
  const heure = now.getHours();
  const minute = now.getMinutes();
  const jour = now.getDay(); // 0 = dimanche

  if (jour === 0 || jour === 6) return; // pas de marché le week-end

  const moments = [
    { h: 9, m: 30, label: 'Ouverture du marché', cle: 'ouverture' },
    { h: 12, m: 0, label: 'Point mi-journée', cle: 'midi' },
    { h: 16, m: 0, label: 'Clôture du marché', cle: 'cloture' },
  ];

  for (const mmt of moments) {
    if (heure === mmt.h && minute === mmt.m) {
      const cacheKey = `notif-${mmt.cle}-${now.toDateString()}`;
      const already = await caches.open('notif-log').then((c) => c.match(cacheKey));
      if (!already) {
        self.registration.showNotification('Briefing Marchés', {
          body: `${mmt.label} — ouvre l'app pour ton résumé.`,
          icon: './icon-192.png',
          tag: 'briefing-marche',
        });
        const c = await caches.open('notif-log');
        await c.put(cacheKey, new Response('sent'));
      }
    }
  }
}

// Periodic Background Sync (si supporté et permission accordée par Chrome)
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'verifier-briefing') {
    e.waitUntil(checkBriefingTime());
  }
});
