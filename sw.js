/* Service worker: que la página abra sin conexión.

   Importa en un local de ensayo o en un aula con wifi de pena: instalada en la
   pantalla de inicio, esto arranca igual sin red.

   OJO AL DESPLEGAR: la caché lleva versión y la estrategia es "caché primero",
   así que todos los ficheros salen de la misma generación y nunca se mezclan
   versiones de los módulos. El precio es que hay que SUBIR LA VERSIÓN de aquí
   abajo en cada despliegue que toque los ficheros; si no, quien ya tenga la
   app instalada seguirá viendo la versión vieja. */
const VERSION = "v1";
const CACHE = `compas-orbital-${VERSION}`;

const PRECACHE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "assets/styles.css",
  "assets/compas.js",
  "assets/audio.js",
  "assets/dial.js",
  "assets/store.js",
  "assets/app.js",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "apple-touch-icon.png"
];

/* En desarrollo el service worker se instala (para poder probarlo) pero no
   intercepta nada: si cacheara, estarías editando ficheros que no se ven. */
const DEV = ["localhost", "127.0.0.1"].includes(self.location.hostname);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (DEV) return;
  const req = event.request;
  if (req.method !== "GET") return;
  /* Las tipografías vienen de Google: a la red. Sin conexión caen en la pila
     de reserva que declara el CSS, que para eso está. */
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => {
        /* Sin red y sin caché: a una navegación se le puede dar la página;
           a un fichero, no se le puede inventar nada. */
        return req.mode === "navigate" ? caches.match("index.html") : Response.error();
      });
    })
  );
});
