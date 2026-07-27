"use client";

import { useState, useTransition } from "react";
import { Music, Trash2 } from "lucide-react";
import { borrarPista } from "@/app/actions/musica";

export type MiPista = {
  id: string;
  titulo: string;
  artista: string | null;
  tipo: "sesion" | "cancion";
  origen: "r2" | "mixcloud" | "soundcloud";
};

/**
 * Lista de "mi música" con botón de borrar. Igual que en la galería, la
 * política RLS de `pistas` ya solo deja borrar lo propio o, si eres admin,
 * cualquiera.
 */
export default function MiMusica({ pistas }: { pistas: MiPista[] }) {
  const [lista, setLista] = useState(pistas);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function eliminar(p: MiPista) {
    if (!confirm(`¿Eliminar «${p.titulo}»? No se puede deshacer.`)) return;

    setBorrandoId(p.id);
    startTransition(async () => {
      try {
        await borrarPista(p.id);
        setLista((prev) => prev.filter((x) => x.id !== p.id));
      } catch {
        // Se deja en la lista para poder reintentar.
      } finally {
        setBorrandoId(null);
      }
    });
  }

  if (lista.length === 0) {
    return <p className="mt-2 text-sm text-white/40">Todavía no has subido música.</p>;
  }

  return (
    <ul className="mt-3 space-y-2">
      {lista.map((p) => (
        <li
          key={p.id}
          className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5"
        >
          <Music size={16} className="shrink-0 text-white/40" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{p.titulo}</p>
            <p className="truncate text-xs text-white/50">
              {[p.artista, p.tipo === "sesion" ? "Sesión" : "Canción"]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => eliminar(p)}
            disabled={borrandoId === p.id}
            aria-label={`Eliminar ${p.titulo}`}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/40 transition-colors duration-200 hover:bg-red-500/15 hover:text-red-400 disabled:opacity-50"
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
