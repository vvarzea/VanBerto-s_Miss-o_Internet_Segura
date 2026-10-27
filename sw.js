/* Service worker — VanBerto's Missão Internet Segura. Rede primeiro para HTML/JS/CSS (as alterações aparecem logo), cache para funcionar offline. */
const CACHE = 'vb-missao-internet-segura-v1';
const CORE = ['./', 'index.html', 'main.js', 'style.css', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

self.addEventListener('install', e => {
  // um ficheiro em falta não deve impedir a instalação dos restantes
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !isFont) return;

  if (isFont) { // tipos de letra: cache primeiro, atualiza em segundo plano
    e.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  e.respondWith(
    fetch(req)
      .then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r; })
      .catch(() => caches.match(req).then(hit => hit || caches.match('index.html')))
  );
});
