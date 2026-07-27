"use client";

import { useEffect, useRef, useState } from "react";
import { Send, SmilePlus, X, Check } from "lucide-react";
import { EMOJIS_PICKER, type Mensaje } from "./tipos";

/**
 * La barra de abajo: cita de respuesta, aviso de edición, teclado de emojis y
 * campo de texto.
 *
 * El texto en curso vive **aquí dentro** a propósito. Cuando estaba en el
 * componente del chat, cada tecla volvía a pintar la lista entera de
 * mensajes; ahora una pulsación solo repinta esta barra.
 */
export default function BarraEscritura({
  respondiendoA,
  editando,
  userId,
  pedirFoco,
  onCancelarRespuesta,
  onCancelarEdicion,
  onEnviar,
  onGuardarEdicion,
}: {
  respondiendoA: Mensaje | null;
  editando: Mensaje | null;
  userId: string;
  /** Cambia de valor cada vez que el chat quiere el cursor en el campo. */
  pedirFoco: number;
  onCancelarRespuesta: () => void;
  onCancelarEdicion: () => void;
  onEnviar: (texto: string) => void;
  onGuardarEdicion: (texto: string) => void;
}) {
  // Al entrar en modo edición el chat remonta esta barra (con `key`), así que
  // el texto del mensaje que se edita es sencillamente el valor inicial.
  const [texto, setTexto] = useState(editando?.texto ?? "");
  const [mostrarEmojis, setMostrarEmojis] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (pedirFoco > 0) textareaRef.current?.focus();
  }, [pedirFoco]);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio) return;

    setTexto("");
    setMostrarEmojis(false);
    if (editando) onGuardarEdicion(limpio);
    else onEnviar(limpio);
  }

  return (
    // En móvil se separa del fondo lo que mide la barra de navegación
    // inferior (56px + zona segura del teléfono); en escritorio no hay barra
    // inferior, así que se pega abajo del todo.
    <div className="sticky bottom-[calc(56px+env(safe-area-inset-bottom))] border-t border-white/10 bg-black/95 backdrop-blur-md md:bottom-0">
      {respondiendoA && (
        <div className="flex items-center gap-2 border-b border-white/10 px-1 pt-2">
          <div className="min-w-0 flex-1 rounded-lg border-l-2 border-white/30 bg-white/5 px-2.5 py-1.5 text-xs">
            <p className="font-medium text-white/70">
              Respondiendo a{" "}
              {respondiendoA.autor_id === userId ? "ti mismo" : respondiendoA.autor ?? "Miembro"}
            </p>
            <p className="truncate text-white/50">
              {respondiendoA.borrado ? "Mensaje eliminado" : respondiendoA.texto}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelarRespuesta}
            aria-label="Cancelar respuesta"
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/50 hover:text-white"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {editando && (
        <div className="flex items-center gap-2 border-b border-white/10 px-1 pt-2">
          <p className="flex-1 text-xs font-medium text-white/60">Editando mensaje</p>
          <button
            type="button"
            onClick={onCancelarEdicion}
            aria-label="Cancelar edición"
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/50 hover:text-white"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {mostrarEmojis && (
        <div className="grid grid-cols-10 gap-1 border-b border-white/10 px-2 py-2">
          {EMOJIS_PICKER.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                setTexto((prev) => prev + e);
                textareaRef.current?.focus();
              }}
              className="cursor-pointer rounded-lg p-1.5 text-xl transition-colors duration-100 hover:bg-white/10"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={enviar} className="flex items-end gap-2 py-3">
        <button
          type="button"
          onClick={() => setMostrarEmojis((v) => !v)}
          aria-label="Emojis"
          className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ${
            mostrarEmojis ? "bg-white/15 text-white" : "text-white/50 hover:text-white"
          }`}
        >
          <SmilePlus size={20} aria-hidden="true" />
        </button>

        <label htmlFor="mensaje" className="sr-only">
          Escribe un mensaje
        </label>
        <textarea
          ref={textareaRef}
          id="mensaje"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar(e);
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder={editando ? "Edita tu mensaje…" : "Mensaje…"}
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-white/20 bg-white/5 px-4 py-2.5 text-base outline-none transition-colors duration-200 focus:border-white"
        />
        <button
          type="submit"
          disabled={!texto.trim()}
          aria-label={editando ? "Guardar edición" : "Enviar mensaje"}
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-black transition-opacity duration-200 hover:opacity-85 disabled:opacity-30"
        >
          {editando ? <Check size={18} aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
        </button>
      </form>
    </div>
  );
}
