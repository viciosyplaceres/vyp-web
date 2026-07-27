"use client";

import { useTransition } from "react";
import { Trash2, Image as ImageIcon, Video, Music } from "lucide-react";
import { borrarMediaAdmin, borrarPistaAdmin } from "@/app/actions/almacenamiento";
import { formatearBytes } from "@/lib/formato";

export type MediaConTamano = {
  id: string;
  tipo: "foto" | "video";
  anio: number;
  storage_id: string;
  descripcion: string | null;
  bytes: number | null;
};

export type PistaConTamano = {
  id: string;
  titulo: string;
  origen: "r2" | "mixcloud" | "soundcloud";
  url: string;
  bytes: number | null;
};

function BarraProgreso({
  etiqueta,
  porcentaje,
  detalle,
  bloqueado,
}: {
  etiqueta: string;
  porcentaje: number;
  detalle: string;
  bloqueado: boolean;
}) {
  const pct = Math.min(100, Math.round(porcentaje * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{etiqueta}</p>
        <p className="text-xs text-white/50">{detalle}</p>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            bloqueado ? "bg-red-400" : pct >= 75 ? "bg-amber-400" : "bg-white"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {bloqueado && (
        <p className="mt-1 text-xs text-red-400">
          Casi al límite: las subidas nuevas de este tipo están bloqueadas.
        </p>
      )}
    </div>
  );
}

export default function PanelAlmacenamiento({
  cloudinaryPorcentaje,
  cloudinayDetalle,
  cloudinaryBloqueado,
  r2Porcentaje,
  r2Detalle,
  r2Bloqueado,
  media,
  pistas,
}: {
  cloudinaryPorcentaje: number;
  cloudinayDetalle: string;
  cloudinaryBloqueado: boolean;
  r2Porcentaje: number;
  r2Detalle: string;
  r2Bloqueado: boolean;
  media: MediaConTamano[];
  pistas: PistaConTamano[];
}) {
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="mt-6 space-y-8">
      <section className="space-y-5 rounded-xl border border-white/15 p-4">
        <BarraProgreso
          etiqueta="Fotos y vídeos (Cloudinary)"
          porcentaje={cloudinaryPorcentaje}
          detalle={cloudinayDetalle}
          bloqueado={cloudinaryBloqueado}
        />
        <BarraProgreso
          etiqueta="Música (R2)"
          porcentaje={r2Porcentaje}
          detalle={r2Detalle}
          bloqueado={r2Bloqueado}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold">
          Fotos y vídeos, de mayor a menor
        </h2>
        {media.length === 0 ? (
          <p className="mt-2 text-sm text-white/40">No hay nada en la galería.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {media.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5"
              >
                {m.tipo === "video" ? (
                  <Video size={16} className="shrink-0 text-white/40" aria-hidden="true" />
                ) : (
                  <ImageIcon size={16} className="shrink-0 text-white/40" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {m.descripcion || `Fiestas de ${m.anio}`}
                  </p>
                  <p className="text-xs text-white/50">
                    {m.anio} · {formatearBytes(m.bytes)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Borrar del almacenamiento"
                  disabled={pendiente}
                  onClick={() =>
                    startTransition(() => {
                      void borrarMediaAdmin(m.id, m.anio, m.storage_id, m.tipo);
                    })
                  }
                  className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/30 transition-colors duration-200 hover:text-red-400 disabled:opacity-40"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Música propia, de mayor a menor</h2>
        {pistas.length === 0 ? (
          <p className="mt-2 text-sm text-white/40">
            No hay música guardada en R2 (los enlaces de Mixcloud/SoundCloud no
            ocupan espacio nuestro).
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {pistas.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5"
              >
                <Music size={16} className="shrink-0 text-white/40" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{p.titulo}</p>
                  <p className="text-xs text-white/50">{formatearBytes(p.bytes)}</p>
                </div>
                <button
                  type="button"
                  aria-label="Borrar del almacenamiento"
                  disabled={pendiente}
                  onClick={() =>
                    startTransition(() => {
                      void borrarPistaAdmin(p.id, p.origen, p.url);
                    })
                  }
                  className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/30 transition-colors duration-200 hover:text-red-400 disabled:opacity-40"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
