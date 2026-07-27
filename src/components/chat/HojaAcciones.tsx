"use client";

import { useEffect } from "react";
import { Reply, Pencil, Trash2, Copy, X } from "lucide-react";
import { EMOJIS_RAPIDOS, type Mensaje } from "./tipos";

/**
 * El menú que sale al mantener pulsado un mensaje (o al hacerle clic con el
 * ratón): reaccionar, responder, copiar y —si es tuyo— editar o borrar.
 *
 * Va anclado abajo, como el menú de compartir del móvil, en vez de flotando
 * junto a la burbuja: así nunca se sale de la pantalla ni lo recorta la lista,
 * caiga el mensaje donde caiga.
 *
 * Se dibuja una sola vez en el chat, no una por mensaje: son doscientos
 * mensajes en pantalla y no tiene sentido tener doscientos menús ocultos.
 */
export default function HojaAcciones({
  mensaje,
  mio,
  miEmoji,
  onCerrar,
  onReaccionar,
  onResponder,
  onEditar,
  onEliminar,
}: {
  mensaje: Mensaje;
  mio: boolean;
  /** Con qué emoji ha reaccionado ya esta persona, para marcarlo. */
  miEmoji: string | null;
  onCerrar: () => void;
  onReaccionar: (id: string, emoji: string) => void;
  onResponder: (m: Mensaje) => void;
  onEditar: (m: Mensaje) => void;
  onEliminar: (id: string) => void;
}) {
  // Escape cierra, como cualquier ventana modal.
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar]);

  const accion =
    "flex min-h-[52px] w-full cursor-pointer items-center gap-3 rounded-xl px-4 text-left text-[15px] transition-colors duration-150 hover:bg-white/10";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Acciones del mensaje"
      className="fixed inset-0 z-50 flex flex-col justify-end"
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className="absolute inset-0 cursor-pointer bg-black/60 backdrop-blur-[2px]"
      />

      <div className="relative mx-auto w-full max-w-md p-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <div className="overflow-hidden rounded-2xl border border-white/15 bg-neutral-950 shadow-2xl">
          {/* Una muestra del mensaje, para saber sobre cuál se está actuando. */}
          <p className="truncate border-b border-white/10 px-4 py-3 text-sm text-white/50">
            {mensaje.texto}
          </p>

          {/* Reacciones rápidas */}
          <div className="flex justify-around border-b border-white/10 px-2 py-2">
            {EMOJIS_RAPIDOS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  onReaccionar(mensaje.id, e);
                  onCerrar();
                }}
                aria-label={`Reaccionar con ${e}`}
                aria-pressed={miEmoji === e}
                className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-2xl transition-transform duration-100 hover:scale-110 ${
                  miEmoji === e ? "bg-white/15" : ""
                }`}
              >
                {e}
              </button>
            ))}
          </div>

          <div className="p-1.5">
            <button
              type="button"
              onClick={() => {
                onResponder(mensaje);
                onCerrar();
              }}
              className={accion}
            >
              <Reply size={18} className="text-white/60" aria-hidden="true" />
              Responder
            </button>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(mensaje.texto).catch(() => undefined);
                onCerrar();
              }}
              className={accion}
            >
              <Copy size={18} className="text-white/60" aria-hidden="true" />
              Copiar texto
            </button>

            {mio && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onEditar(mensaje);
                    onCerrar();
                  }}
                  className={accion}
                >
                  <Pencil size={18} className="text-white/60" aria-hidden="true" />
                  Editar
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onEliminar(mensaje.id);
                    onCerrar();
                  }}
                  className={`${accion} text-red-400 hover:bg-red-500/10`}
                >
                  <Trash2 size={18} aria-hidden="true" />
                  Eliminar
                </button>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onCerrar}
          className="mt-2 flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/15 bg-neutral-950 text-[15px] font-medium transition-colors duration-150 hover:bg-white/10"
        >
          <X size={17} aria-hidden="true" />
          Cancelar
        </button>
      </div>
    </div>
  );
}
