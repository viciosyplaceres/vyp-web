import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OMITIR_DIRECTORIOS = new Set([
  ".codebase-memory",
  ".git",
  ".next",
  ".vercel",
  "node_modules",
]);
const OMITIR_DIRECTORIOS_RAIZ = new Set(["design", "docs", "supabase", "tests"]);
const OMITIR_FICHEROS = new Set(["CREDENCIALES.md", "README.md"]);

function debeOmitirse(nombre, esDirectorio, directorio) {
  if (esDirectorio) {
    return (
      OMITIR_DIRECTORIOS.has(nombre) ||
      (directorio === RAIZ && OMITIR_DIRECTORIOS_RAIZ.has(nombre))
    );
  }
  return (
    OMITIR_FICHEROS.has(nombre) ||
    nombre.startsWith(".env") ||
    nombre.endsWith(".tsbuildinfo") ||
    nombre.endsWith(".log")
  );
}

async function listarFicheros(directorio = RAIZ) {
  const resultado = [];
  for (const entrada of await readdir(directorio, { withFileTypes: true })) {
    if (debeOmitirse(entrada.name, entrada.isDirectory(), directorio)) continue;
    const absoluto = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      resultado.push(...(await listarFicheros(absoluto)));
    } else if (entrada.isFile()) {
      const info = await stat(absoluto);
      resultado.push({
        absoluto,
        file: path.relative(RAIZ, absoluto).split(path.sep).join("/"),
        size: info.size,
      });
    }
  }
  return resultado;
}

function sha1(contenido) {
  return createHash("sha1").update(contenido).digest("hex");
}

async function peticionVercel(ruta, token, opciones = {}) {
  const respuesta = await fetch(`https://api.vercel.com${ruta}`, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opciones.headers ?? {}),
    },
  });
  const texto = await respuesta.text();
  let cuerpo = null;
  try {
    cuerpo = texto ? JSON.parse(texto) : null;
  } catch {
    cuerpo = texto;
  }
  if (!respuesta.ok) {
    const detalle =
      typeof cuerpo === "string"
        ? cuerpo
        : cuerpo?.error?.message || cuerpo?.message || JSON.stringify(cuerpo);
    throw new Error(`Vercel ${respuesta.status}: ${detalle}`);
  }
  return cuerpo;
}

async function enGrupos(elementos, limite, tarea) {
  for (let i = 0; i < elementos.length; i += limite) {
    await Promise.all(elementos.slice(i, i + limite).map(tarea));
  }
}

async function desplegar() {
  const ficheros = await listarFicheros();
  const bytes = ficheros.reduce((total, fichero) => total + fichero.size, 0);

  if (process.argv.includes("--dry-run")) {
    console.log(JSON.stringify({ ficheros: ficheros.length, bytes }));
    return;
  }

  const token = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !teamId || !projectId) {
    throw new Error("Faltan VERCEL_TOKEN, VERCEL_TEAM_ID o VERCEL_PROJECT_ID.");
  }

  const referencias = [];
  await enGrupos(ficheros, 8, async (fichero) => {
    const contenido = await readFile(fichero.absoluto);
    const sha = sha1(contenido);
    await peticionVercel(`/v2/files?teamId=${encodeURIComponent(teamId)}`, token, {
      method: "POST",
      headers: {
        "Content-Length": String(contenido.length),
        "Content-Type": "application/octet-stream",
        "x-Vercel-Digest": sha,
      },
      body: contenido,
    });
    referencias.push({ file: fichero.file, sha, size: contenido.length });
  });

  const parametros = new URLSearchParams({
    forceNew: "1",
    skipAutoDetectionConfirmation: "1",
    teamId,
  });
  const creado = await peticionVercel(`/v13/deployments?${parametros}`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "vyp-web",
      project: projectId,
      target: "production",
      files: referencias,
      meta: { source: "jarvis-deploys" },
    }),
  });

  const limite = Date.now() + 8 * 60 * 1000;
  let despliegue = creado;
  while (!["READY", "ERROR", "CANCELED", "BLOCKED"].includes(despliegue.readyState)) {
    if (Date.now() >= limite) throw new Error("Vercel no terminó el build en 8 minutos.");
    await new Promise((resolve) => setTimeout(resolve, 3000));
    despliegue = await peticionVercel(
      `/v13/deployments/${encodeURIComponent(creado.id)}?teamId=${encodeURIComponent(teamId)}`,
      token,
    );
  }

  if (despliegue.readyState !== "READY") {
    throw new Error(
      `Vercel terminó en ${despliegue.readyState}: ${despliegue.errorMessage || despliegue.readyStateReason || "sin detalle"}`,
    );
  }

  console.log(
    JSON.stringify({
      id: despliegue.id,
      readyState: despliegue.readyState,
      target: despliegue.target,
      url: `https://${despliegue.url}`,
      alias: despliegue.alias ?? [],
      ficheros: referencias.length,
      bytes,
    }),
  );
}

desplegar().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
