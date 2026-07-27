"use client";

import { Play, Pause, SkipBack, SkipForward, X } from "lucide-react";
import { useReproductor } from "./ReproductorProvider";
import { formatearDuracion } from "@/lib/embeds";

export default function BarraReproductor() {
  const {
    actual,
    sonando,
    posicion,
    duracion,
    alternar,
    siguiente,
    anterior,
    buscar,
    cerrar,
  } = useReproductor();

  if (!actual) return null;

  const progreso = duracion > 0 ? (posicion / duracion) * 100 : 0;

  return (
    <div className="fixed inset-x-0 bottom-[56px] z-40 border-t border-white/10 bg-neutral-950/95 backdrop-blur-md md:bottom-0">
      <div className="mx-auto max-w-5xl px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] md:pb-2.5">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{actual.titulo}</p>
            <p className="truncate text-xs text-white/50">
              {actual.artista ?? "Vicios & Placeres"}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={anterior}
              aria-label="Pista anterior"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white/70 transition-colors duration-200 hover:text-white"
            >
              <SkipBack size={18} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={alternar}
              aria-label={sonando ? "Pausar" : "Reproducir"}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white text-black transition-opacity duration-200 hover:opacity-85"
            >
              {sonando ? (
                <Pause size={18} aria-hidden="true" />
              ) : (
                <Play size={18} className="ml-0.5" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={siguiente}
              aria-label="Pista siguiente"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white/70 transition-colors duration-200 hover:text-white"
            >
              <SkipForward size={18} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar reproductor"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white/40 transition-colors duration-200 hover:text-white"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mt-1.5 flex items-center gap-2">
          <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-white/40">
            {formatearDuracion(posicion)}
          </span>
          <input
            type="range"
            min={0}
            max={duracion || 0}
            value={posicion}
            step={1}
            aria-label="Posición de la pista"
            onChange={(e) => buscar(Number(e.target.value))}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-white"
            style={{
              background: `linear-gradient(to right, #fff ${progreso}%, rgba(255,255,255,0.2) ${progreso}%)`,
            }}
          />
          <span className="w-10 shrink-0 text-[11px] tabular-nums text-white/40">
            {formatearDuracion(duracion)}
          </span>
        </div>
      </div>
    </div>
  );
}
