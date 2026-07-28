"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, Loader2, MessageSquareX, X } from "lucide-react";
import { vaciarHistorialChat } from "@/app/actions/chat";

export default function VaciarChat() {
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierto) return;
    cancelarRef.current?.focus();
    function cerrarConEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    window.addEventListener("keydown", cerrarConEscape);
    return () => window.removeEventListener("keydown", cerrarConEscape);
  }, [abierto]);

  function confirmar() {
    setError(null);
    startTransition(async () => {
      try {
        const borrados = await vaciarHistorialChat();
        setAbierto(false);
        setResultado(
          borrados === 1
            ? "Se ha borrado 1 mensaje y todo su historial asociado."
            : `Se han borrado ${borrados} mensajes y todo su historial asociado.`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo borrar el chat.");
      }
    });
  }

  return (
    <>
      <section className="mb-6 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
        <div className="flex items-start gap-3">
          <MessageSquareX size={19} className="mt-0.5 shrink-0 text-red-300" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Historial del chat</p>
            <p className="mt-0.5 text-xs leading-relaxed text-white/50">
              Elimina para siempre todos los mensajes, reacciones y marcas de lectura.
            </p>
          </div>
        </div>

        {resultado && (
          <p role="status" className="mt-3 text-sm text-white/60">
            {resultado}
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            setError(null);
            setAbierto(true);
          }}
          className="mt-4 inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-red-400/40 px-5 text-sm font-medium text-red-200 transition-colors duration-200 hover:bg-red-500/10 sm:w-auto"
        >
          <MessageSquareX size={17} aria-hidden="true" />
          Borrar historial del chat
        </button>
      </section>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !pendiente) setAbierto(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-vaciar-chat"
            aria-describedby="descripcion-vaciar-chat"
            className="w-full max-w-md rounded-2xl border border-red-400/30 bg-zinc-950 p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-300">
                <AlertTriangle size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="titulo-vaciar-chat" className="text-lg font-semibold">
                  ¿Borrar todo el historial?
                </h2>
                <p id="descripcion-vaciar-chat" className="mt-2 text-sm leading-relaxed text-white/60">
                  Los mensajes se eliminarán físicamente junto con sus reacciones y marcas de
                  lectura. No quedará copia en la aplicación y esta acción no se puede deshacer.
                </p>
              </div>
              <button
                type="button"
                disabled={pendiente}
                onClick={() => setAbierto(false)}
                aria-label="Cerrar aviso"
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/40 transition-colors duration-200 hover:bg-white/10 hover:text-white disabled:opacity-40"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {error && (
              <p role="alert" className="mt-4 text-sm text-red-300">
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                ref={cancelarRef}
                type="button"
                disabled={pendiente}
                onClick={() => setAbierto(false)}
                className="inline-flex min-h-[48px] cursor-pointer items-center justify-center rounded-full border border-white/20 px-5 text-sm transition-colors duration-200 hover:bg-white/10 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={pendiente}
                onClick={confirmar}
                className="inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-full bg-red-500 px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-red-400 disabled:opacity-50"
              >
                {pendiente && <Loader2 size={17} className="animate-spin" aria-hidden="true" />}
                {pendiente ? "Borrando…" : "Sí, borrar todo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
