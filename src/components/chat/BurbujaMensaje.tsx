"use client";

import { memo, useMemo } from "react";
import { Reply, Pencil, Trash2, SmilePlus, Check, CheckCheck } from "lucide-react";
import { horaCorta } from "@/lib/formato";
import Avatar from "../Avatar";
import { EMOJIS_RAPIDOS, type Mensaje, type Reaccion } from "./tipos";

/**
 * Una burbuja del chat, con sus acciones y sus reacciones.
 *
 * Va envuelta en `memo` a propósito: antes toda la lista se volvía a pintar
 * con cada pulsación de tecla en la barra de escritura, porque el texto en
 * curso vivía en el mismo componente que los mensajes. Para que `memo` sirva
 * de algo, el padre le pasa datos ya resueltos (`leido`, `pickerAbierto`) y
 * funciones estables, nunca objetos creados durante el render.
 */
function BurbujaMensaje({
  mensaje: m,
  mio,
  userId,
  reacciones,
  autorOriginalEsMio,
  leido,
  pickerAbierto,
  onAlternarPicker,
  onReaccionar,
  onResponder,
  onEditar,
  onEliminar,
}: {
  mensaje: Mensaje;
  mio: boolean;
  userId: string;
  reacciones: Reaccion[];
  autorOriginalEsMio: boolean;
  leido: boolean;
  pickerAbierto: boolean;
  onAlternarPicker: (id: string) => void;
  onReaccionar: (id: string, emoji: string) => void;
  onResponder: (m: Mensaje) => void;
  onEditar: (m: Mensaje) => void;
  onEliminar: (id: string) => void;
}) {
  const esTemporal = m.id.startsWith("temp-");

  const grupos = useMemo(() => {
    const mapa = new Map<string, Reaccion[]>();
    for (const r of reacciones) {
      (mapa.get(r.emoji) ?? mapa.set(r.emoji, []).get(r.emoji)!).push(r);
    }
    return mapa;
  }, [reacciones]);

  const botonAccion =
    "flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-sm transition-colors duration-150 hover:bg-white/20 hover:text-white";

  return (
    <div className={`flex items-end gap-2 ${mio ? "justify-end" : "justify-start"}`}>
      {!mio && (
        <Avatar nombre={m.autor} avatarUrl={m.avatarUrl} tamano={28} className="mb-0.5" />
      )}

      <div className={`flex max-w-[80%] flex-col ${mio ? "items-end" : "items-start"}`}>
        <div className="relative">
          <div
            className={`rounded-2xl px-3.5 py-2 ${
              mio ? "rounded-br-md bg-white text-black" : "rounded-bl-md bg-white/10 text-white"
            } ${m.borrado ? "italic opacity-60" : ""}`}
          >
            {!mio && !m.borrado && (
              <p className="text-xs font-medium text-white/60">{m.autor ?? "Miembro"}</p>
            )}

            {m.respuestaA && !m.borrado && (
              <div
                className={`mb-1.5 rounded-lg border-l-2 px-2 py-1 text-xs ${
                  mio
                    ? "border-black/30 bg-black/5 text-black/70"
                    : "border-white/30 bg-white/5 text-white/70"
                }`}
              >
                <p className="font-medium">
                  {autorOriginalEsMio ? "Tú" : m.respuestaAutor ?? "Miembro"}
                </p>
                <p className="truncate">{m.respuestaTexto}</p>
              </div>
            )}

            <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">
              {m.borrado ? "Mensaje eliminado" : m.texto}
            </p>

            <div
              className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] tabular-nums ${
                mio ? "text-black/40" : "text-white/40"
              }`}
            >
              {m.editadoAt && !m.borrado && <span>editado</span>}
              <span>{horaCorta(m.created_at)}</span>
              {mio && !esTemporal && (
                leido ? (
                  <CheckCheck size={13} className="text-sky-500" aria-label="Leído" />
                ) : (
                  <CheckCheck size={13} aria-label="Enviado" />
                )
              )}
              {mio && esTemporal && <Check size={13} aria-label="Enviando" />}
            </div>
          </div>

          {/* Acciones: responder siempre, editar/eliminar solo lo propio. */}
          {!m.borrado && (
            <div
              className={`pointer-events-none absolute top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover/msg:pointer-events-auto group-hover/msg:opacity-100 ${
                mio ? "right-full mr-1" : "left-full ml-1"
              }`}
            >
              <button
                type="button"
                onClick={() => onAlternarPicker(m.id)}
                aria-label="Reaccionar"
                className={botonAccion}
              >
                <SmilePlus size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onResponder(m)}
                aria-label="Responder"
                className={botonAccion}
              >
                <Reply size={15} aria-hidden="true" />
              </button>
              {mio && (
                <>
                  <button
                    type="button"
                    onClick={() => onEditar(m)}
                    aria-label="Editar"
                    className={botonAccion}
                  >
                    <Pencil size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEliminar(m.id)}
                    aria-label="Eliminar"
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-sm transition-colors duration-150 hover:bg-red-500/20 hover:text-red-400"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          )}

          {pickerAbierto && (
            <div
              className={`absolute top-full z-10 mt-1 flex gap-1 rounded-full border border-white/15 bg-neutral-900 px-2 py-1.5 shadow-lg ${
                mio ? "right-0" : "left-0"
              }`}
            >
              {EMOJIS_RAPIDOS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => onReaccionar(m.id, e)}
                  className="cursor-pointer rounded-full p-1 text-lg transition-transform duration-100 hover:scale-125"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        {grupos.size > 0 && (
          <div className={`mt-1 flex flex-wrap gap-1 ${mio ? "justify-end" : "justify-start"}`}>
            {[...grupos.entries()].map(([emoji, lista]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReaccionar(m.id, emoji)}
                title={lista.map((r) => r.nombre ?? "Miembro").join(", ")}
                className={`flex cursor-pointer items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors duration-150 ${
                  lista.some((r) => r.perfilId === userId)
                    ? "border-white/40 bg-white/15"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <span>{emoji}</span>
                {lista.length > 1 && <span className="text-white/60">{lista.length}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(BurbujaMensaje);
