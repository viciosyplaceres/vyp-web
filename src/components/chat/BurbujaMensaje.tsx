"use client";

import { memo, useCallback, useMemo } from "react";
import { MoreHorizontal, Check, CheckCheck } from "lucide-react";
import { horaCorta } from "@/lib/formato";
import Avatar from "../Avatar";
import { type Mensaje, type Reaccion } from "./tipos";
import { usePulsacionLarga } from "./usePulsacionLarga";

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
  onAbrirMenu,
  onReaccionar,
  soloLectura,
}: {
  mensaje: Mensaje;
  mio: boolean;
  userId: string;
  reacciones: Reaccion[];
  autorOriginalEsMio: boolean;
  leido: boolean;
  onAbrirMenu: (m: Mensaje) => void;
  /** Solo para el atajo de tocar una reacción ya puesta; el resto va por el menú. */
  onReaccionar: (id: string, emoji: string) => void;
  soloLectura: boolean;
}) {
  const esTemporal = m.id.startsWith("temp-");

  // Un mensaje ya borrado no tiene nada que ofrecer: ni responder a "Mensaje
  // eliminado" ni editarlo.
  const abrirMenu = useCallback(() => {
    if (!m.borrado) onAbrirMenu(m);
  }, [m, onAbrirMenu]);

  const gesto = usePulsacionLarga(abrirMenu);

  const grupos = useMemo(() => {
    const mapa = new Map<string, Reaccion[]>();
    for (const r of reacciones) {
      (mapa.get(r.emoji) ?? mapa.set(r.emoji, []).get(r.emoji)!).push(r);
    }
    return mapa;
  }, [reacciones]);

  return (
    <div className={`flex items-end gap-2 ${mio ? "justify-end" : "justify-start"}`}>
      {!mio && (
        <Avatar nombre={m.autor} avatarUrl={m.avatarUrl} tamano={28} className="mb-0.5" />
      )}

      <div className={`flex max-w-[80%] flex-col ${mio ? "items-end" : "items-start"}`}>
        <div className="relative">
          {/* Mantener pulsado (o hacer clic con el ratón) abre las acciones.
              `select-none` evita que el móvil empiece a seleccionar el texto a
              media pulsación; para eso está "Copiar texto" en el menú. */}
          <div
            {...(m.borrado ? {} : gesto)}
            className={`select-none rounded-2xl px-3.5 py-2 ${
              mio ? "rounded-br-md bg-white text-black" : "rounded-bl-md bg-white/10 text-white"
            } ${m.borrado ? "italic opacity-60" : "cursor-pointer"}`}
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

              {/* Botón "···" siempre visible, dentro de la propia burbuja: el
                  flotante de antes solo aparecía al pasar el ratón por
                  encima, así que en el móvil (el uso principal de la app) no
                  había NINGUNA pista de que las acciones existieran. La
                  pulsación larga sigue funcionando como atajo, pero esto es
                  lo que de verdad se ve y se toca. */}
              {!esTemporal && !m.borrado && (
                <button
                  type="button"
                  onClick={abrirMenu}
                  // El botón vive dentro del área con el gesto de pulsación
                  // larga: sin cortar la propagación, tocarlo también arma el
                  // temporizador del padre y en ratón llega a disparar el
                  // menú dos veces.
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label="Acciones del mensaje"
                  className={`-mr-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 ${
                    mio
                      ? "text-black/40 hover:bg-black/10 hover:text-black"
                      : "text-white/40 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <MoreHorizontal size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>

        {grupos.size > 0 && (
          <div className={`mt-1 flex flex-wrap gap-1 ${mio ? "justify-end" : "justify-start"}`}>
            {[...grupos.entries()].map(([emoji, lista]) => {
              const contenido = (
                <>
                  <span>{emoji}</span>
                  {lista.length > 1 && <span className="text-white/60">{lista.length}</span>}
                </>
              );
              const className = `flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs ${
                lista.some((r) => r.perfilId === userId)
                  ? "border-white/40 bg-white/15"
                  : "border-white/10 bg-white/5"
              }`;

              return soloLectura ? (
                <span
                  key={emoji}
                  title={lista.map((r) => r.nombre ?? "Miembro").join(", ")}
                  className={className}
                >
                  {contenido}
                </span>
              ) : (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReaccionar(m.id, emoji)}
                  title={lista.map((r) => r.nombre ?? "Miembro").join(", ")}
                  className={`${className} cursor-pointer transition-colors duration-150 hover:bg-white/10`}
                >
                  {contenido}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(BurbujaMensaje);
