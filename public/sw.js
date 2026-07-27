// Service worker de la peña VYP.
// Hace dos cosas: permitir instalar la web como app (PWA) y recibir los avisos
// del chat cuando la app está cerrada.

const CACHE = "vyp-v4";
const ESENCIALES = ["/manifest.webmanifest", "/logo/vyp-icon-192.png"];

/**
 * Página de respaldo cuando una navegación no llega al servidor.
 *
 * Se genera aquí mismo, sin tocar la caché: el contenido de las páginas
 * depende de la sesión y nunca se guarda (ver más abajo), así que lo único
 * que se puede enseñar sin riesgo es un aviso genérico.
 */
function paginaSinConexion() {
  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sin conexión · Vicios & Placeres</title>
<style>
 body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
 background:#000;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:24px}
 p{color:rgba(255,255,255,.6);margin:8px 0 24px}
 button{min-height:48px;padding:0 24px;border-radius:999px;border:0;background:#fff;
 color:#000;font:inherit;font-weight:500;cursor:pointer}
</style></head><body><div>
<h1>Sin conexión</h1>
<p>No hemos podido cargar la página. Comprueba la conexión y vuelve a intentarlo.</p>
<button onclick="location.reload()">Reintentar</button>
</div></body></html>`,
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ESENCIALES))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))),
      )
      .then(() => self.clients.claim()),
  );
});

// Estrategia deliberadamente conservadora: la red manda siempre, y solo se
// recurre a la caché si no hay conexión. Así nadie ve fotos o mensajes viejos
// por culpa de una caché agresiva.
self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Nunca cachear API ni audio: siempre en vivo.
  if (url.pathname.startsWith("/api/")) return;

  // Las páginas (HTML y las peticiones RSC de la navegación de Next.js) no se
  // cachean NUNCA: su contenido depende de quién ha iniciado sesión (aprobado
  // o no, admin o no...). Si se guardara una y luego la red fallara un
  // instante, el service worker podía servírsela después a otra sesión, o a
  // la misma persona ya aprobada la respuesta vieja de "cuenta pendiente" que
  // vio antes de que se le aprobara — justo lo que le pasó de verdad a un
  // miembro real. Solo se cachean los recursos estáticos (JS, CSS, iconos),
  // que son iguales para todo el mundo.
  const esDocumento = req.mode === "navigate" || req.destination === "document";
  if (esDocumento) {
    // Sin caché de respaldo a propósito: sin conexión, que se vea un aviso
    // genérico antes que arriesgarse a enseñar la página de otra sesión.
    //
    // El `catch` no es opcional: si `fetch` rechaza y se le pasa esa promesa
    // rota a `respondWith`, el navegador tira el fetch entero con "the promise
    // was rejected" y la pestaña se queda en blanco, sin siquiera el aviso de
    // "sin conexión" del propio navegador. Pasó de verdad: un fallo puntual
    // del servidor dejó la app rota con ese error en consola.
    event.respondWith(fetch(req).catch(() => paginaSinConexion()));
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && req.destination !== "audio" && req.destination !== "video") {
          const copia = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copia)).catch(() => undefined);
        }
        return res;
      })
      // `caches.match` devuelve `undefined` cuando ese recurso no estaba
      // guardado, y `respondWith(undefined)` revienta con "Failed to convert
      // value to 'Response'". Hay que acabar siempre en una Response de
      // verdad: `Response.error()` es un fallo de red normal, que el navegador
      // ya sabe manejar.
      .catch(() => caches.match(req).then((guardada) => guardada ?? Response.error())),
  );
});

// ---- Notificaciones push ----

self.addEventListener("push", (event) => {
  let datos = { titulo: "Vicios & Placeres", cuerpo: "", url: "/" };
  try {
    if (event.data) datos = { ...datos, ...event.data.json() };
  } catch {
    if (event.data) datos.cuerpo = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(datos.titulo, {
      body: datos.cuerpo,
      icon: "/logo/vyp-icon-192.png",
      badge: "/logo/vyp-icon-192.png",
      // Cada tipo de aviso (chat, galería, música, gestión…) se agrupa por su
      // cuenta: así una tanda de fotos no entierra los mensajes del chat.
      tag: datos.tag || "vyp",
      renotify: true,
      vibrate: [80, 40, 80],
      data: { url: datos.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientes) => {
        // Si la app ya está abierta, la trae al frente en vez de abrir otra.
        for (const cliente of clientes) {
          if ("focus" in cliente) {
            cliente.navigate(destino).catch(() => undefined);
            return cliente.focus();
          }
        }
        return self.clients.openWindow(destino);
      }),
  );
});
