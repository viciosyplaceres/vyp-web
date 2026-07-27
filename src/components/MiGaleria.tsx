"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, Trash2 } from "lucide-react";
import { borrarMedia } from "@/app/actions/media";

export type MiFoto = {
  id: string;
  anio: number;
  tipo: "foto" | "video";
  url: string;
  thumb_url: string | null;
  descripcion: string | null;
};

/**
 * Grid de "mis fotos y vídeos" con botón de borrar en cada tile. La base de
 * datos ya solo deja borrar lo propio (o cualquier cosa si eres admin, vía
 * RLS en `media`), así que este botón nunca es la única barrera.
 */
export default function MiGaleria({ fotos }: { fotos: MiFoto[] }) {
  const [lista, setLista] = useState(fotos);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function eliminar(f: MiFoto) {
    if (!confirm("¿Eliminar esto de la galería? No se puede deshacer.")) return;

    setBorrandoId(f.id);
    startTransition(async () => {
      try {
        await borrarMedia(f.id, f.anio);
        setLista((prev) => prev.filter((x) => x.id !== f.id));
      } catch {
        // Se deja tal cual: si algo falla, sigue en la lista y se puede reintentar.
      } finally {
        setBorrandoId(null);
      }
    });
  }

  if (lista.length === 0) {
    return (
      <p className="mt-2 text-sm text-white/40">
        Todavía no has subido nada a la galería.
      </p>
    );
  }

  return (
    <ul className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2">
      {lista.map((m) => (
        <li key={m.id} className="group relative aspect-square overflow-hidden rounded-md bg-white/5">
          <Link
            href={`/galeria/${m.anio}/${m.id}`}
            className="block h-full w-full cursor-pointer"
          >
            <Image
              src={m.thumb_url || m.url}
              alt={m.descripcion || `Foto de ${m.anio}`}
              fill
              sizes="(max-width: 640px) 33vw, 25vw"
              className="object-cover transition-opacity duration-200 group-hover:opacity-80"
            />
            {m.tipo === "video" && (
              <span className="absolute bottom-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70">
                <Play size={12} className="ml-0.5" aria-hidden="true" />
                <span className="sr-only">Vídeo</span>
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => eliminar(m)}
            disabled={borrandoId === m.id}
            aria-label="Eliminar de la galería"
            className="absolute right-1.5 top-1.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white/80 backdrop-blur-sm transition-colors duration-200 hover:bg-red-500/80 hover:text-white disabled:opacity-50"
          >
            <Trash2 size={13} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
