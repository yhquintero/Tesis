/* Service worker de Prenómina UPR: carcasa offline y caché de activos. */
const VERSION = 'prenomina-v2';
const CARCASA = [
  '/',
  '/index.html',
  '/css/app.css',
  '/js/app.js',
  '/js/api.js',
  '/js/ui.js',
  '/js/charts.js',
  '/js/sesion.js',
  '/js/pages/login.js',
  '/js/pages/panel.js',
  '/js/pages/profesores.js',
  '/js/pages/contratos.js',
  '/js/pages/pagos.js',
  '/js/pages/prenomina.js',
  '/js/pages/usuarios.js',
  '/js/pages/configuracion.js',
  '/js/pages/auditoria.js',
  '/js/pages/ayuda.js',
  '/assets/logo.svg',
  '/manifest.webmanifest',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(CARCASA))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((clave) => clave !== VERSION).map((clave) => caches.delete(clave))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const solicitud = evento.request;
  if (solicitud.method !== 'GET') return;
  const url = new URL(solicitud.url);

  if (url.pathname.startsWith('/api/')) {
    evento.respondWith(fetch(solicitud));
    return;
  }

  if (solicitud.mode === 'navigate') {
    evento.respondWith(
      fetch(solicitud).catch(() => caches.match('/index.html').then((respuesta) => respuesta || Response.error())),
    );
    return;
  }

  evento.respondWith(
    fetch(solicitud)
      .then((respuesta) => {
        if (respuesta.ok && url.origin === location.origin) {
          const copia = respuesta.clone();
          caches.open(VERSION).then((cache) => cache.put(solicitud, copia));
        }
        return respuesta;
      })
      .catch(() => caches.match(solicitud).then((cacheada) => cacheada || Response.error())),
  );
});
