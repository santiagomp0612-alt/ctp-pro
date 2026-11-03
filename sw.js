/* =====================================================================
   CTP Pro — sw.js (service worker)
   ---------------------------------------------------------------------
   Guarda una copia de los archivos de la app en el celular para que
   funcione SIN INTERNET después de la primera visita.

   Estrategia "usar la copia y actualizar por detrás":
   la app abre al instante con la copia guardada y, si hay internet,
   descarga la versión nueva para la próxima vez que se abra.

   Si cambiás la lista de archivos, subí el número de versión (v2, v3…).
   ===================================================================== */

const VERSION = 'ctp-pro-v2';
const ARCHIVOS = [
  './',
  './index.html',
  './style.css',
  './config.js',
  './calculos.js',
  './app.js',
  './manifest.webmanifest',
  './icono.svg',
  './icono-192.png',
  './icono-512.png',
];

// 1) Instalación: guardar todos los archivos
self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(ARCHIVOS)));
  self.skipWaiting();
});

// 2) Activación: borrar copias de versiones viejas
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(nombres.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});

// 3) Cada vez que la app pide un archivo
self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  // Solo archivos de nuestra propia página (nunca de otros sitios)
  if (pedido.method !== 'GET' || new URL(pedido.url).origin !== self.location.origin) return;

  evento.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const guardada = await cache.match(pedido, { ignoreSearch: true });
      const deInternet = fetch(pedido)
        .then((respuesta) => {
          if (respuesta.ok) cache.put(pedido, respuesta.clone());
          return respuesta;
        })
        .catch(() => guardada || cache.match('./index.html'));
      // Si tenemos copia, la usamos ya; si no, esperamos a internet
      return guardada || deInternet;
    })
  );
});
