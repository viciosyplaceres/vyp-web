"use client";

import { ExternalLink, Pause, Play } from "lucide-react";
import { useReproductor, type PistaReproducible } from "./ReproductorProvider";
import type { PistaListada } from "./ListaMusica";

/**
 * Versión reducida de la lista de música para la portada: solo título,
 * artista y un botón de play. Sin los iframes de Mixcloud/SoundCloud (esos
 * se quedan en /musica) para no cargar la home con reproductores incrustados.
 */
export default function MusicaCompacta({
  pistas,
}: {
  pistas: PistaListada[];
}) {
  const { actual, sonando, reproducir, alternar } = useReproductor();

  const propias: PistaReproducible[] = pistas
    .filter((p) => p.origen === "r2")
    .map((p) => ({ id: p.id, titulo: p.titulo, artista: p.artista, clave: p.url }));

  if (pistas.length === 0) return null;

  return (
    <ul className="space-y-2">
      {pistas.map((p) => {
        const esActual = actual?.id === p.id;
        const esPropia = p.origen === "r2";

        return (
          <li
            key={p.id}
            className="flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5 transition-colors duration-200 hover:border-white/25"
          >
            {esPropia ? (
              <button
                type="button"
                aria-label={
                  esActual && sonando ? `Pausar ${p.titulo}` : `Reproducir ${p.titulo}`
                }
                onClick={() => {
                  if (esActual) alternar();
                  else
                    reproducir(
                      { id: p.id, titulo: p.titulo, artista: p.artista, clave: p.url },
                      propias,
                    );
                }}
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-black transition-opacity duration-200 hover:opacity-85"
              >
                {esActual && sonando ? (
                  <Pause size={16} aria-hidden="true" />
                ) : (
                  <Play size={16} className="ml-0.5" aria-hidden="true" />
                )}
              </button>
            ) : (
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Abrir ${p.titulo} en ${p.origen === "mixcloud" ? "Mixcloud" : "SoundCloud"}`}
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/25 text-white/60 transition-colors duration-200 hover:text-white"
              >
                <ExternalLink size={15} aria-hidden="true" />
              </a>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.titulo}</p>
              <p className="truncate text-xs text-white/50">
                {[p.artista, p.tipo === "sesion" ? "Sesión" : "Canción"]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
