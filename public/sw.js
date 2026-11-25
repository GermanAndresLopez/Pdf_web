// Service worker mínimo: la app funciona sin conexión una vez visitada.
const CACHE = 'pdfweb-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin) return
  const save = (res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
    return res
  }
  if (req.mode === 'navigate') {
    // La página principal: primero la red (para recibir versiones nuevas), con la caché como respaldo
    e.respondWith(fetch(req).then(save).catch(() => caches.match(req).then((r) => r || caches.match('/'))))
    return
  }
  // Archivos con nombre único (JS/CSS/WASM/fuentes): caché primero
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then(save)))
})
