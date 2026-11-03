/* =====================================================================
   CTP Pro — sw.js (service worker)
   ---------------------------------------------------------------------
   Guarda una copia de los archivos de la app en el celular para que
   funcione SIN INTERNET después de la primera visita.

   Estrategia "primero internet, si no hay, la copia":
   - Con internet: siempre se pide la versión más nueva (así los cambios
     se ven de una vez) y se actualiza la copia guardada.
   - Sin internet (o si la red tarda más de 3 segundos): se usa la copia.

   Para publicar cambios NO hace falta tocar este archivo: basta con subir
   el número "?v=" en index.html. Solo si agregás o quitás archivos de la
   lista de abajo, subí también VERSION (v4, v5…).
   ===================================================================== */

const VERSION = 'ctp-pro-v3';
const ESPERA_MAXIMA_MS = 3000; // si internet tarda más que esto, usamos la copia
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

// 1) Instalación: guardar todos los archivos.
//    cache: 'reload' obliga a bajarlos de internet y no de la memoria del navegador
//    (si no, podríamos guardar otra vez una versión vieja).
self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(VERSION).then((cache) =>
      cache.addAll(ARCHIVOS.map((url) => new Request(url, { cache: 'reload' }))))
  );
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
  evento.respondWith(primeroInternet(evento, pedido));
});

async function primeroInternet(evento, pedido) {
  const cache = await caches.open(VERSION);

  // cache: 'no-cache' = preguntarle siempre al servidor si hay versión nueva
  const deInternet = fetch(pedido, { cache: 'no-cache' }).then((respuesta) => {
    if (respuesta.ok) {
      const copia = respuesta.clone();
      evento.waitUntil(cache.put(pedido, copia));
    }
    return respuesta;
  });

  // Carrera: internet contra un reloj de 3 segundos
  const reloj = new Promise((resolver) => setTimeout(resolver, ESPERA_MAXIMA_MS, 'tarde'));
  try {
    const ganador = await Promise.race([deInternet, reloj]);
    if (ganador !== 'tarde') return ganador;
    // Internet está lento: si hay copia, usarla; si no, seguir esperando
    const guardada = await cache.match(pedido, { ignoreSearch: true });
    return guardada || await deInternet;
  } catch (e) {
    // Sin internet: usar la copia (o la página principal si es una navegación)
    const guardada = await cache.match(pedido, { ignoreSearch: true });
    if (guardada) return guardada;
    if (pedido.mode === 'navigate') {
      const inicio = await cache.match('./index.html');
      if (inicio) return inicio;
    }
    throw e;
  }
}
