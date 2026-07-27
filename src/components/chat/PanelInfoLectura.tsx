"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import { horaCorta } from "@/lib/formato";
import Avatar from "../Avatar";
import type { InfoAutor, Mensaje } from "./tipos";

/**
 * Quién ha visto un mensaje y quién no, al estilo "Info del mensaje" de
 * WhatsApp — pero sin hora exacta de cuándo vio ESE mensaje en concreto,
 * porque `chat_lecturas` no guarda una marca por mensaje, sino "hasta qué
 * momento ha leído cada uno" (mismo dato que ya mueve el doble check azul).
 * Alguien cuenta como "visto" si su última lectura es igual o posterior a
 * cuándo se envió el mensaje; la hora que se enseña es esa última lectura,
 * no el instante exacto en que pasó por este mensaje.
 *
 * Se dibuja una sola vez en el chat, igual que `HojaAcciones`: no tiene
 * sentido montar un panel oculto por cada una de las 200 burbujas.
 */
export default function PanelInfoLectura({
  mensaje,
  autores,
  lecturas,
  onCerrar,
}: {
  mensaje: Mensaje;
  autores: Record<string, InfoAutor>;
  lecturas: Record<string, string>;
  onCerrar: () => void;
}) {
  const { vistos, noVistos } = useMemo(() => {
    const creado = new Date(mensaje.created_at).getTime();
    const vistos: { id: string; info: InfoAutor; cuando: string }[] = [];
    const noVistos: { id: string; info: InfoAutor }[] = [];

    // El propio autor no cuenta ni como "visto" ni como "pendiente": es de
    // quien es el mensaje, no un destinatario más.
    for (const [id, info] of Object.entries(autores)) {
      if (id === mensaje.autor_id) continue;
      const marca = lecturas[id];
      if (marca && new Date(marca).getTime() >= creado) {
        vistos.push({ id, info, cuando: marca });
      } else {
        noVistos.push({ id, info });
      }
    }

    // Quien lo ha visto más recientemente, primero (igual que WhatsApp).
    vistos.sort((a, b) => new Date(b.cuando).getTime() - new Date(a.cuando).getTime());
    noVistos.sort((a, b) => (a.info.nombre ?? "").localeCompare(b.info.nombre ?? "", "es"));

    return { vistos, noVistos };
  }, [mensaje.autor_id, mensaje.created_at, autores, lecturas]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quién ha visto el mensaje"
      className="fixed inset-0 z-50 flex flex-col justify-end"
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className="absolute inset-0 cursor-pointer bg-black/60 backdrop-blur-[2px]"
      />

      <div className="relative mx-auto flex w-full max-w-md flex-col p-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <div className="flex max-h-[65vh] flex-col overflow-hidden rounded-2xl border border-white/15 bg-neutral-950 shadow-2xl">
          <div className="shrink-0 border-b border-white/10 px-4 py-3">
            <p className="text-sm font-medium">Info del mensaje</p>
            <p className="mt-1 truncate text-xs text-white/50">
              {mensaje.borrado ? "Mensaje eliminado" : mensaje.texto}
            </p>
          </div>

          <div className="overflow-y-auto p-1.5">
            <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-white/40">
              Visto por {vistos.length}
            </p>
            {vistos.length === 0 ? (
              <p className="px-3 pb-3 text-sm text-white/40">Todavía nadie lo ha visto.</p>
            ) : (
              <ul>
                {vistos.map(({ id, info, cuando }) => (
                  <li key={id} className="flex items-center gap-3 px-3 py-2">
                    <Avatar nombre={info.nombre} avatarUrl={info.avatarUrl} tamano={32} />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {info.nombre ?? "Miembro"}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-white/40">
                      {horaCorta(cuando)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {noVistos.length > 0 && (
              <>
                <p className="px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-white/40">
                  Todavía no lo ha visto {noVistos.length === 1 ? "" : `(${noVistos.length})`}
                </p>
                <ul>
                  {noVistos.map(({ id, info }) => (
                    <li key={id} className="flex items-center gap-3 px-3 py-2 opacity-50">
                      <Avatar nombre={info.nombre} avatarUrl={info.avatarUrl} tamano={32} />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {info.nombre ?? "Miembro"}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onCerrar}
          className="mt-2 flex min-h-[52px] w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/15 bg-neutral-950 text-[15px] font-medium transition-colors duration-150 hover:bg-white/10"
        >
          <X size={17} aria-hidden="true" />
          Cerrar
        </button>
      </div>
    </div>
  );
}
