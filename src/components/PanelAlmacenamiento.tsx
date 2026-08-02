"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { Trash2, Video, Music, Play, X } from "lucide-react";
import {
  borrarMediaAdmin,
  borrarMediaLote,
  borrarPistaAdmin,
} from "@/app/actions/almacenamiento";
import { formatearBytes } from "@/lib/formato";
import { alternarSeleccion, alternarTodas } from "@/lib/seleccion";

export type MediaConTamano = {
  id: string;
  tipo: "foto" | "video";
  anio: number;
  storage_id: string;
  descripcion: string | null;
  bytes: number | null;
  url: string;
  thumb_url: string | null;
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

function Miniatura({ m }: { m: MediaConTamano }) {
  const src = m.thumb_url || (m.tipo === "foto" ? m.url : null);
  if (!src) {
    return (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-white/5 text-white/40">
        <Video size={18} aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className="relative block h-12 w-12 shrink-0 overflow-hidden rounded-md bg-white/5">
      <Image
        src={src}
        alt={m.descripcion || `Fiestas de ${m.anio}`}
        fill
        sizes="48px"
        className="object-cover"
      />
      {m.tipo === "video" && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/35">
          <Play size={14} className="ml-0.5" aria-hidden="true" />
          <span className="sr-only">Vídeo</span>
        </span>
      )}
    </span>
  );
}

type Confirmacion =
  | { tipo: "seleccionadas"; elementos: MediaConTamano[] }
  | { tipo: "todas"; elementos: MediaConTamano[] };

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
  const [seleccion, setSeleccion] = useState<ReadonlySet<string>>(new Set());
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const seleccionadas = media.filter((m) => seleccion.has(m.id));
  const todasMarcadas =
    media.length > 0 && media.every((m) => seleccion.has(m.id));

  // Escape cierra el modal de confirmación.
  useEffect(() => {
    if (!confirmacion) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmacion(null);
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [confirmacion]);

  function borrarLote(elementos: MediaConTamano[]) {
    setError(null);
    startTransition(async () => {
      try {
        await borrarMediaLote(
          elementos.map((m) => ({
            id: m.id,
            anio: m.anio,
            storageId: m.storage_id,
            tipo: m.tipo,
          })),
        );
        setSeleccion(new Set());
        setConfirmacion(null);
      } catch {
        setError("No se pudo completar el borrado. Reinténtalo en un momento.");
        setConfirmacion(null);
      }
    });
  }

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
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pendiente}
                onClick={() =>
                  setSeleccion((s) => alternarTodas(s, media.map((m) => m.id)))
                }
                className="min-h-[44px] cursor-pointer rounded-lg border border-white/15 px-3 text-sm text-white/70 transition-colors duration-200 hover:border-white/40 hover:text-white disabled:opacity-40"
              >
                {todasMarcadas ? "Deseleccionar todas" : "Seleccionar todas"}
              </button>
              <span className="text-xs text-white/50" aria-live="polite">
                {seleccionadas.length > 0
                  ? `${seleccionadas.length} seleccionada${seleccionadas.length === 1 ? "" : "s"}`
                  : `${media.length} en total`}
              </span>
              <span className="flex-1" />
              {seleccionadas.length > 0 && (
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() =>
                    setConfirmacion({
                      tipo: "seleccionadas",
                      elementos: seleccionadas,
                    })
                  }
                  className="min-h-[44px] cursor-pointer rounded-lg border border-red-400/40 px-3 text-sm text-red-300 transition-colors duration-200 hover:bg-red-400/10 disabled:opacity-40"
                >
                  Borrar seleccionadas ({seleccionadas.length})
                </button>
              )}
              <button
                type="button"
                disabled={pendiente}
                onClick={() => setConfirmacion({ tipo: "todas", elementos: media })}
                className="min-h-[44px] cursor-pointer rounded-lg bg-red-500/90 px-3 text-sm font-medium text-white transition-colors duration-200 hover:bg-red-500 disabled:opacity-40"
              >
                Eliminar todas
              </button>
            </div>

            {error && (
              <p role="alert" className="mt-2 text-sm text-red-400">
                {error}
              </p>
            )}

            <ul className="mt-3 space-y-2">
              {media.map((m) => (
                <li
                  key={m.id}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-200 ${
                    seleccion.has(m.id)
                      ? "border-red-400/50 bg-red-400/[0.06]"
                      : "border-white/10"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={seleccion.has(m.id)}
                    onChange={() =>
                      setSeleccion((s) => alternarSeleccion(s, m.id))
                    }
                    aria-label={`Seleccionar ${m.descripcion || `foto de ${m.anio}`}`}
                    className="h-5 w-5 shrink-0 cursor-pointer accent-red-500"
                  />
                  <Miniatura m={m} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {m.descripcion || `Fiestas de ${m.anio}`}
                    </p>
                    <p className="text-xs text-white/50">
                      {m.tipo === "video" ? "Vídeo" : "Foto"} · {m.anio} ·{" "}
                      {formatearBytes(m.bytes)}
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
          </>
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

      {confirmacion && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-confirmar-borrado"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => !pendiente && setConfirmacion(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-white/15 bg-neutral-950 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3
                id="titulo-confirmar-borrado"
                className="text-lg font-semibold text-red-300"
              >
                {confirmacion.tipo === "todas"
                  ? "Eliminar todas las fotos y vídeos"
                  : `Eliminar ${confirmacion.elementos.length} seleccionada${confirmacion.elementos.length === 1 ? "" : "s"}`}
              </h3>
              <button
                type="button"
                aria-label="Cerrar"
                disabled={pendiente}
                onClick={() => setConfirmacion(null)}
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/40 transition-colors duration-200 hover:text-white disabled:opacity-40"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p className="mt-3 text-sm text-white/65">
              Se borrarán {confirmacion.elementos.length}{" "}
              {confirmacion.elementos.length === 1 ? "elemento" : "elementos"} de
              la galería y de Cloudinary, liberando su espacio.{" "}
              <span className="font-medium text-red-300">
                Esta acción no se puede deshacer.
              </span>
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={pendiente}
                onClick={() => setConfirmacion(null)}
                className="min-h-[44px] flex-1 cursor-pointer rounded-lg border border-white/15 text-sm text-white/70 transition-colors duration-200 hover:border-white/40 hover:text-white disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={pendiente}
                onClick={() => borrarLote(confirmacion.elementos)}
                className="min-h-[44px] flex-1 cursor-pointer rounded-lg bg-red-500/90 text-sm font-medium text-white transition-colors duration-200 hover:bg-red-500 disabled:opacity-40"
              >
                {pendiente ? "Borrando…" : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
