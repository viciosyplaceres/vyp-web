"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Music, Link2 } from "lucide-react";
import { registrarPistaR2, registrarPistaEnlace } from "@/app/actions/musica";

const ANIOS = Array.from(
  { length: new Date().getFullYear() - 2010 + 1 },
  (_, i) => new Date().getFullYear() - i,
);

/** Lee la duración del audio en el navegador para no guardarla a ojo. */
function leerDuracion(fichero: File): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(fichero);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration) : null);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    audio.src = url;
  });
}

export default function SubirMusica({ onSubido }: { onSubido?: () => void }) {
  const router = useRouter();
  const [modo, setModo] = useState<"fichero" | "enlace">("fichero");

  // --- Subida de fichero a R2 ---
  const [fichero, setFichero] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [artista, setArtista] = useState("");
  const [tipo, setTipo] = useState<"sesion" | "cancion">("sesion");
  const [anio, setAnio] = useState<number | "">("");
  const [progreso, setProgreso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Enlace externo ---
  const [estadoEnlace, accionEnlace, pendienteEnlace] = useActionState(
    registrarPistaEnlace,
    null,
  );

  // El estado inicial es `null`, así que esto no salta al montar: solo
  // cuando el server action responde sin error, es decir, tras un envío real.
  useEffect(() => {
    if (estadoEnlace && !estadoEnlace.error) {
      onSubido?.();
      router.push("/musica");
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoEnlace]);

  async function subirFichero(e: React.FormEvent) {
    e.preventDefault();
    if (!fichero || !titulo.trim()) return;

    setError(null);
    try {
      setProgreso("Preparando…");
      const duracion = await leerDuracion(fichero);

      const resUrl = await fetch("/api/r2/subir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: fichero.name,
          contentType: fichero.type,
          tamano: fichero.size,
        }),
      });

      if (!resUrl.ok) {
        const cuerpo = await resUrl.json().catch(() => ({}));
        throw new Error(cuerpo.error ?? "No se pudo preparar la subida.");
      }

      const { url, clave } = await resUrl.json();

      setProgreso("Subiendo… (puede tardar con una sesión larga)");
      const subida = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": fichero.type },
        body: fichero,
      });

      if (!subida.ok) throw new Error("Falló la subida del audio.");

      setProgreso("Guardando…");
      await registrarPistaR2({
        titulo,
        artista,
        tipo,
        anio: anio === "" ? null : Number(anio),
        clave,
        duracionS: duracion,
      });

      setProgreso(null);
      setFichero(null);
      setTitulo("");
      setArtista("");
      onSubido?.();
      router.push("/musica");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir.");
      setProgreso(null);
    }
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Forma de añadir música"
        className="mb-5 flex gap-2"
      >
        <button
          role="tab"
          aria-selected={modo === "fichero"}
          onClick={() => setModo("fichero")}
          className={`inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors duration-200 ${
            modo === "fichero"
              ? "bg-white text-black"
              : "border border-white/25 text-white/70 hover:bg-white/10"
          }`}
        >
          <Music size={16} aria-hidden="true" />
          Subir archivo
        </button>
        <button
          role="tab"
          aria-selected={modo === "enlace"}
          onClick={() => setModo("enlace")}
          className={`inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors duration-200 ${
            modo === "enlace"
              ? "bg-white text-black"
              : "border border-white/25 text-white/70 hover:bg-white/10"
          }`}
        >
          <Link2 size={16} aria-hidden="true" />
          Pegar enlace
        </button>
      </div>

      {modo === "fichero" ? (
        <form onSubmit={subirFichero} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="audio" className="text-sm text-white/70">
              Archivo de audio
            </label>
            <input
              id="audio"
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFichero(f);
                if (f && !titulo) setTitulo(f.name.replace(/\.[^.]+$/, ""));
              }}
              className="block w-full cursor-pointer rounded-lg border border-white/20 bg-white/5 px-3 py-3 text-sm file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-black"
            />
            <p className="text-xs text-white/40">
              Hasta 500 MB. Las sesiones largas caben de sobra.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="titulo" className="text-sm text-white/70">
              Título
            </label>
            <input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              className="min-h-[48px] w-full rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="artista" className="text-sm text-white/70">
              Artista o DJ (opcional)
            </label>
            <input
              id="artista"
              value={artista}
              onChange={(e) => setArtista(e.target.value)}
              className="min-h-[48px] w-full rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label htmlFor="tipo" className="text-sm text-white/70">
                Tipo
              </label>
              <select
                id="tipo"
                value={tipo}
                onChange={(e) =>
                  setTipo(e.target.value as "sesion" | "cancion")
                }
                className="min-h-[48px] w-full cursor-pointer rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
              >
                <option value="sesion" className="bg-black">
                  Sesión
                </option>
                <option value="cancion" className="bg-black">
                  Canción
                </option>
              </select>
            </div>

            <div className="flex-1 space-y-1.5">
              <label htmlFor="anioMusica" className="text-sm text-white/70">
                Año (opcional)
              </label>
              <select
                id="anioMusica"
                value={anio}
                onChange={(e) =>
                  setAnio(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="min-h-[48px] w-full cursor-pointer rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
              >
                <option value="" className="bg-black">
                  —
                </option>
                {ANIOS.map((a) => (
                  <option key={a} value={a} className="bg-black">
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}
          {progreso && (
            <p aria-live="polite" className="text-sm text-white/70">
              {progreso}
            </p>
          )}

          <button
            type="submit"
            disabled={!fichero || !titulo.trim() || Boolean(progreso)}
            className="min-h-[48px] w-full cursor-pointer rounded-full bg-white px-6 font-medium text-black transition-opacity duration-200 hover:opacity-85 disabled:opacity-40"
          >
            {progreso ? "Subiendo…" : "Subir música"}
          </button>
        </form>
      ) : (
        <form action={accionEnlace} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="enlace" className="text-sm text-white/70">
              Enlace de Mixcloud o SoundCloud
            </label>
            <input
              id="enlace"
              name="enlace"
              type="url"
              required
              placeholder="https://www.mixcloud.com/…"
              className="min-h-[48px] w-full rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
            />
            <p className="text-xs text-white/40">
              Para sesiones que el DJ ya subió a su cuenta: no ocupan espacio
              nuestro.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="tituloEnlace" className="text-sm text-white/70">
              Título
            </label>
            <input
              id="tituloEnlace"
              name="titulo"
              required
              className="min-h-[48px] w-full rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="artistaEnlace" className="text-sm text-white/70">
              Artista o DJ (opcional)
            </label>
            <input
              id="artistaEnlace"
              name="artista"
              className="min-h-[48px] w-full rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="anioEnlace" className="text-sm text-white/70">
              Año (opcional)
            </label>
            <select
              id="anioEnlace"
              name="anio"
              className="min-h-[48px] w-full cursor-pointer rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
            >
              <option value="" className="bg-black">
                —
              </option>
              {ANIOS.map((a) => (
                <option key={a} value={a} className="bg-black">
                  {a}
                </option>
              ))}
            </select>
          </div>

          {estadoEnlace?.error && (
            <p role="alert" className="text-sm text-red-400">
              {estadoEnlace.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pendienteEnlace}
            className="min-h-[48px] w-full cursor-pointer rounded-full bg-white px-6 font-medium text-black transition-opacity duration-200 hover:opacity-85 disabled:opacity-40"
          >
            {pendienteEnlace ? "Guardando…" : "Añadir enlace"}
          </button>
        </form>
      )}
    </div>
  );
}
