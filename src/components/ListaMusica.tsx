"use client";

import { useMemo, useState } from "react";
import { Play, Pause, ExternalLink, ListMusic } from "lucide-react";
import { useReproductor, type PistaReproducible } from "./ReproductorProvider";
import { formatearDuracion } from "@/lib/embeds";
import Avatar from "./Avatar";

export type PistaListada = {
  id: string;
  titulo: string;
  artista: string | null;
  tipo: "sesion" | "cancion";
  anio: number | null;
  origen: "r2" | "mixcloud" | "soundcloud";
  url: string;
  embed_url: string | null;
  duracion_s: number | null;
  subidoPorId: string | null;
  subidoPorNombre: string | null;
  subidoPorAvatar: string | null;
};

function aReproducible(p: PistaListada): PistaReproducible {
  return { id: p.id, titulo: p.titulo, artista: p.artista, clave: p.url };
}

export default function ListaMusica({ pistas }: { pistas: PistaListada[] }) {
  const { actual, sonando, reproducir, alternar } = useReproductor();
  const [filtroId, setFiltroId] = useState<string | null>(null);

  // Quién ha subido algo, para el desplegable del filtro. Solo la gente que
  // realmente aparece en la lista, sin duplicados.
  const autores = useMemo(() => {
    const vistos = new Map<string, { id: string; nombre: string }>();
    for (const p of pistas) {
      if (p.subidoPorId && !vistos.has(p.subidoPorId)) {
        vistos.set(p.subidoPorId, {
          id: p.subidoPorId,
          nombre: p.subidoPorNombre || "Miembro",
        });
      }
    }
    return [...vistos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [pistas]);

  const pistasFiltradas = filtroId
    ? pistas.filter((p) => p.subidoPorId === filtroId)
    : pistas;

  // La cola respeta el filtro: si hay uno puesto, "siguiente" solo se mueve
  // dentro de la música de esa persona, elijas la canción que elijas.
  const cola: PistaReproducible[] = pistasFiltradas
    .filter((p) => p.origen === "r2")
    .map(aReproducible);

  const reproducirTodo = () => {
    const primera = cola[0];
    if (primera) reproducir(primera, cola);
  };

  if (pistas.length === 0) {
    return (
      <p className="mt-10 text-white/50">
        Todavía no hay música. Si eres de la peña, sube una sesión o pega un
        enlace de Mixcloud o SoundCloud desde{" "}
        <span className="text-white">Subir</span>.
      </p>
    );
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <select
          aria-label="Filtrar música por miembro"
          value={filtroId ?? ""}
          onChange={(e) => setFiltroId(e.target.value || null)}
          className="min-h-[44px] cursor-pointer rounded-full border border-white/20 bg-transparent px-4 text-sm text-white [color-scheme:dark]"
        >
          <option value="">Todos los miembros</option>
          {autores.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>

        {cola.length > 0 && (
          <button
            type="button"
            onClick={reproducirTodo}
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-white/20 px-4 text-sm transition-colors duration-200 hover:bg-white/10"
          >
            <ListMusic size={16} aria-hidden="true" />
            Reproducir todo
          </button>
        )}
      </div>

      {pistasFiltradas.length === 0 ? (
        <p className="mt-6 text-white/50">
          Esta persona todavía no ha subido música.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {pistasFiltradas.map((p) => {
        const esActual = actual?.id === p.id;

        if (p.origen === "r2") {
          return (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-xl border border-white/10 p-3 transition-colors duration-200 hover:border-white/25"
            >
              <button
                type="button"
                aria-label={
                  esActual && sonando
                    ? `Pausar ${p.titulo}`
                    : `Reproducir ${p.titulo}`
                }
                onClick={() => {
                  if (esActual) alternar();
                  else reproducir(aReproducible(p), cola);
                }}
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-black transition-opacity duration-200 hover:opacity-85"
              >
                {esActual && sonando ? (
                  <Pause size={18} aria-hidden="true" />
                ) : (
                  <Play size={18} className="ml-0.5" aria-hidden="true" />
                )}
              </button>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.titulo}</p>
                <p className="truncate text-xs text-white/50">
                  {[
                    p.artista,
                    p.tipo === "sesion" ? "Sesión" : "Canción",
                    p.anio,
                    formatearDuracion(p.duracion_s),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>

              <Avatar
                nombre={p.subidoPorNombre}
                avatarUrl={p.subidoPorAvatar}
                tamano={28}
              />
            </li>
          );
        }

        // Mixcloud / SoundCloud: reproductor oficial embebido.
        return (
          <li
            key={p.id}
            className="overflow-hidden rounded-xl border border-white/10"
          >
            <div className="flex items-center justify-between gap-3 px-3 pt-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.titulo}</p>
                <p className="truncate text-xs text-white/50">
                  {[
                    p.artista,
                    p.origen === "mixcloud" ? "Mixcloud" : "SoundCloud",
                    p.anio,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Avatar
                nombre={p.subidoPorNombre}
                avatarUrl={p.subidoPorAvatar}
                tamano={28}
              />

              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Abrir ${p.titulo} en ${p.origen}`}
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/50 transition-colors duration-200 hover:text-white"
              >
                <ExternalLink size={16} aria-hidden="true" />
              </a>
            </div>
            {p.embed_url && (
              <iframe
                src={p.embed_url}
                title={p.titulo}
                loading="lazy"
                allow="autoplay; encrypted-media"
                className="mt-2 h-[120px] w-full border-0"
              />
            )}
          </li>
        );
          })}
        </ul>
      )}
    </>
  );
}
