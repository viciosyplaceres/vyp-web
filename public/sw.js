// Service worker de la peña VYP.
// Hace dos cosas: permitir instalar la web como app (PWA) y recibir los avisos
// del chat cuando la app está cerrada.

const CACHE = "vyp-v5";
const ESENCIALES = ["/manifest.webmanifest", "/logo/vyp-icon-192.png"];

/** Solo recursos públicos e independientes de la sesión. */
function esRecursoCacheable(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/logo/") ||
    ESENCIALES.includes(url.pathname) ||
    url.pathname === "/favicon.ico" ||
    url.pathname === "/og-image.png"
  );
}

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
  // Las páginas no se cachean NUNCA: su contenido depende de quién ha iniciado
  // sesión. Si falla la red, se enseña un aviso genérico en vez de una copia
  // potencialmente perteneciente a otra sesión.
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

  // Next identifica las navegaciones internas con una petición RSC, que no
  // tiene destination="document". Una lista blanca evita guardar tanto esas
  // respuestas como cualquier futura ruta de datos que no hayamos inventariado.
  if (!esRecursoCacheable(url)) return;

  // Los chunks de Next llevan hash y los demás recursos cambian de versión al
  // cambiar CACHE. Cache-first evita red innecesaria sin guardar datos privados.
  event.respondWith(
    caches
      .match(req)
      .then(async (guardada) => {
        if (guardada) return guardada;

        const res = await fetch(req);
        if (res.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(req, res.clone());
        }
        return res;
      })
      .catch(() => Response.error()),
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
