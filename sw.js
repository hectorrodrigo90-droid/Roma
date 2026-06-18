// Roma — service worker
// Objetivo: que la app y las imágenes de ejercicios funcionen sin conexión
// después de la primera carga. NO cachea llamadas a la IA (vertexGenerate)
// ni a Google Cloud — esas siempre van a la red, son el cerebro en vivo.

const CACHE_NAME='roma-cache-v1';
const APP_SHELL=[
  './roma.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).catch(()=>{})
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

  // App shell: cache-first con actualización en segundo plano
  if(APP_SHELL.some(p=>url.endsWith(p.replace('./','')))){
    e.respondWith(
      caches.match(e.request).then(cached=>{
        const network=fetch(e.request).then(resp=>{
          caches.open(CACHE_NAME).then(c=>c.put(e.request,resp.clone()));
          return resp;
        }).catch(()=>cached);
        return cached||network;
      })
    );
  }
});
