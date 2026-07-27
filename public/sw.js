// Service worker de la peña VYP.
// Hace dos cosas: permitir instalar la web como app (PWA) y recibir los avisos
// del chat cuando la app está cerrada.

const CACHE = "vyp-v1";
const ESENCIALES = ["/", "/manifest.webmanifest", "/logo/vyp-icon-192.png"];

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

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && req.destination !== "audio" && req.destination !== "video") {
          const copia = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copia)).catch(() => undefined);
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cacheada) => cacheada ?? caches.match("/")),
      ),
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
      tag: "vyp-chat",
      renotify: true,
      data: { url: datos.url || "/chat" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = event.notification.data?.url || "/chat";

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
