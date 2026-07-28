import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const codigo = readFileSync(
  new URL("../public/sw.js", import.meta.url),
  "utf8",
);

function cargarServiceWorker(fetchImpl) {
  const listeners = new Map();
  const guardadas = new Map();
  const escrituras = [];

  const cache = {
    addAll: async () => undefined,
    put: async (request, response) => {
      escrituras.push(request.url);
      guardadas.set(request.url, response);
    },
  };
  const caches = {
    open: async () => cache,
    keys: async () => [],
    delete: async () => true,
    match: async (request) => guardadas.get(request.url),
  };
  const self = {
    location: { origin: "https://www.viciosyplaceres.com" },
    addEventListener: (tipo, listener) => listeners.set(tipo, listener),
    skipWaiting: async () => undefined,
    clients: {
      claim: async () => undefined,
      matchAll: async () => [],
      openWindow: async () => undefined,
    },
    registration: { showNotification: async () => undefined },
  };

  vm.runInNewContext(codigo, {
    caches,
    fetch: fetchImpl,
    Promise,
    Response,
    self,
    URL,
  });

  return { fetch: listeners.get("fetch"), escrituras };
}

function ejecutarFetch(listener, request) {
  let respuesta = null;
  listener({
    request,
    respondWith: (valor) => {
      respuesta = Promise.resolve(valor);
    },
  });
  return respuesta;
}

function peticion(pathname, overrides = {}) {
  return {
    method: "GET",
    mode: "cors",
    destination: "",
    url: `https://www.viciosyplaceres.com${pathname}`,
    ...overrides,
  };
}

test("no intercepta ni guarda respuestas RSC o rutas de datos", () => {
  const { fetch, escrituras } = cargarServiceWorker(async () => {
    throw new Error("No debe ejecutarse desde el service worker");
  });

  const respuestaRsc = ejecutarFetch(
    fetch,
    peticion("/galeria?_rsc=sesion", {
      headers: new Headers({ RSC: "1", Accept: "text/x-component" }),
    }),
  );
  const respuestaApi = ejecutarFetch(fetch, peticion("/api/r2/reproducir"));

  assert.equal(respuestaRsc, null);
  assert.equal(respuestaApi, null);
  assert.deepEqual(escrituras, []);
});

test("solo guarda recursos estáticos incluidos en la lista blanca", async () => {
  let peticionesRed = 0;
  const { fetch, escrituras } = cargarServiceWorker(async () => {
    peticionesRed += 1;
    return new Response("chunk", { status: 200 });
  });
  const request = peticion("/_next/static/chunks/app-abc123.js", {
    destination: "script",
  });

  const primera = await ejecutarFetch(fetch, request);
  assert.equal(await primera.text(), "chunk");
  assert.equal(peticionesRed, 1);
  assert.deepEqual(escrituras, [request.url]);

  const segunda = await ejecutarFetch(fetch, request);
  assert.equal(await segunda.text(), "chunk");
  assert.equal(peticionesRed, 1);
});

test("una navegación sin red recibe una página genérica", async () => {
  const { fetch, escrituras } = cargarServiceWorker(async () => {
    throw new Error("sin red");
  });
  const respuesta = await ejecutarFetch(
    fetch,
    peticion("/perfil", { mode: "navigate", destination: "document" }),
  );

  assert.equal(respuesta.status, 503);
  assert.match(await respuesta.text(), /Sin conexión/);
  assert.deepEqual(escrituras, []);
});
