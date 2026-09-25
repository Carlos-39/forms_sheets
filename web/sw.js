// Service worker: guarda la app en el dispositivo para que abra y funcione sin internet.
// Estrategia: responde desde la caché de inmediato y actualiza la caché en segundo plano.
// Las llamadas a Google (Apps Script) no pasan por aquí.

const CACHE = 'encuestas-v4';
const ARCHIVOS = [
  './',
  './index.html',
  './config.js',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/calc.js',
  './js/dom.js',
  './js/formulario-base.js',
  './js/storage.js',
  './js/sync.js',
  './js/vista-editor.js',
  './js/vista-formulario.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Ignora ?api=…&clave=… del enlace de configuración.
    const enCache = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    const deRed = fetch(req).then((res) => {
      if (res.ok) cache.put(req.mode === 'navigate' ? './' : req, res.clone());
      return res;
    }).catch(() => null);
    if (enCache) {
      e.waitUntil(deRed);
      return enCache;
    }
    const res = await deRed;
    return res || (req.mode === 'navigate' ? cache.match('./') : Response.error());
  })());
});
