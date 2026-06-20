// Roma — service worker
// Objetivo: que la app y las imágenes de ejercicios funcionen sin conexión
// después de la primera carga. NO cachea llamadas a la IA (vertexGenerate)
// ni a Google Cloud — esas siempre van a la red, son el cerebro en vivo.

const CACHE_NAME='roma-cache-v2'; // v2: ya no depende del nombre del archivo
const APP_SHELL=[
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache=>
      // cache.add() uno por uno: si UNO falla (ej. nombre de archivo distinto),
      // los demás se guardan igual. cache.addAll() fallaba completo por esto.
      Promise.all(APP_SHELL.map(url=>cache.add(url).catch(()=>{})))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const url=e.request.url;

  // Nunca cachear llamadas a Google/Vertex — siempre red, es el cerebro vivo
  if(url.includes('googleapis.com')||url.includes('oauth2')) return;

  // Imágenes de ejercicios y fuentes: cache-first, se guardan la primera vez
  if(url.includes('raw.githubusercontent.com')||url.includes('fonts.gstatic.com')||url.includes('fonts.googleapis.com')){
    e.respondWith(
      caches.match(e.request).then(cached=>cached||fetch(e.request).then(resp=>{
        const copy=resp.clone();
        caches.open(CACHE_NAME).then(c=>c.put(e.request,copy));
        return resp;
      }).catch(()=>cached))
    );
    return;
  }

  // Navegación (abrir/recargar la app) y app shell: red primero, cache de respaldo.
  // Así nunca te quedas viendo una versión vieja pegada si hay internet.
  e.respondWith(
    fetch(e.request).then(resp=>{
      const copy=resp.clone();
      caches.open(CACHE_NAME).then(c=>c.put(e.request,copy));
      return resp;
    }).catch(()=>caches.match(e.request).then(cached=>cached||caches.match('./index.html')))
  );
});
