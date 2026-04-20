// ─────────────────────────────────────────────────────────────────────────────
// Service worker "kamikaze"
// ─────────────────────────────────────────────────────────────────────────────
// Paper-Trade n'utilise PAS de service worker. Mais il arrive qu'un SW
// fantôme d'un ancien projet (PWA précédente sur le même localhost) subsiste
// dans le navigateur et intercepte les requêtes — ce qui génère des 404
// parasites (/login, /novabornelogo.svg, etc.).
//
// Cette route sert un SW minimal qui :
//   1. skip waiting (s'installe immédiatement)
//   2. unregister ses propres enregistrements
//   3. vide tous les caches
//   4. recharge les clients pour repartir propre
//
// Après une seule visite, le navigateur est nettoyé.
// ─────────────────────────────────────────────────────────────────────────────

export default defineEventHandler((event) => {
  setHeader(event, 'Content-Type', 'application/javascript; charset=utf-8')
  setHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate')
  setHeader(event, 'Service-Worker-Allowed', '/')

  return `// Paper-Trade: self-unregistering service worker
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (_) {}
    try {
      await self.registration.unregister();
    } catch (_) {}
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      try { client.navigate(client.url); } catch (_) {}
    }
  })());
});

self.addEventListener('fetch', () => {});
`
})
