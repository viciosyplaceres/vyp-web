"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { enviarMensaje } from "@/app/actions/chat";
import AvisosPush from "./AvisosPush";

export type Mensaje = {
  id: string;
  texto: string;
  created_at: string;
  autor_id: string;
  autor: string | null;
};

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function diaLegible(iso: string) {
  const f = new Date(iso);
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);

  const mismoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (mismoDia(f, hoy)) return "Hoy";
  if (mismoDia(f, ayer)) return "Ayer";
  return f.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: f.getFullYear() === hoy.getFullYear() ? undefined : "numeric",
  });
}

export default function Chat({
  inicial,
  userId,
  nombres,
}: {
  inicial: Mensaje[];
  userId: string;
  nombres: Record<string, string | null>;
}) {
  const [mensajes, setMensajes] = useState<Mensaje[]>(inicial);
  const [texto, setTexto] = useState("");
  const [, startTransition] = useTransition();
  const finRef = useRef<HTMLDivElement>(null);

  const [optimistas, addOptimista] = useOptimistic(
    mensajes,
    (estado, nuevo: Mensaje) => [...estado, nuevo],
  );

  // Escucha en vivo: los mensajes de los demás aparecen sin recargar.
  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel("chat-vyp")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensajes" },
        (payload) => {
          const m = payload.new as {
            id: string;
            texto: string;
            created_at: string;
            autor_id: string;
          };
          setMensajes((prev) =>
            prev.some((x) => x.id === m.id)
              ? prev
              : [
                  ...prev,
                  { ...m, autor: nombres[m.autor_id] ?? null },
                ],
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [nombres]);

  // Siempre abajo, como en cualquier app de mensajería.
  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [optimistas.length]);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio) return;

    setTexto("");
    startTransition(async () => {
      addOptimista({
        id: `temp-${Date.now()}`,
        texto: limpio,
        created_at: new Date().toISOString(),
        autor_id: userId,
        autor: null,
      });
      await enviarMensaje(limpio);
    });
  }

  // Se calcula antes de pintar en qué mensajes toca separador de día, para no
  // ir mutando una variable durante el render.
  const conSeparador = optimistas.map((m, i) => {
    const dia = diaLegible(m.created_at);
    const anterior = i > 0 ? diaLegible(optimistas[i - 1].created_at) : null;
    return { mensaje: m, dia, separador: dia !== anterior };
  });

  return (
    <div className="flex flex-1 flex-col">
      <AvisosPush />

      <ol className="flex-1 space-y-2 py-4">
        {optimistas.length === 0 && (
          <li className="py-10 text-center text-sm text-white/40">
            Aún no hay mensajes. Escribe el primero.
          </li>
        )}

        {conSeparador.map(({ mensaje: m, dia, separador }) => {
          const mio = m.autor_id === userId;

          return (
            <li key={m.id}>
              {separador && (
                <p className="my-4 text-center text-[11px] uppercase tracking-wider text-white/30">
                  {dia}
                </p>
              )}
              <div
                className={`flex ${mio ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
                    mio
                      ? "rounded-br-md bg-white text-black"
                      : "rounded-bl-md bg-white/10 text-white"
                  }`}
                >
                  {!mio && (
                    <p className="text-xs font-medium text-white/60">
                      {m.autor ?? "Miembro"}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">
                    {m.texto}
                  </p>
                  <p
                    className={`mt-0.5 text-right text-[10px] tabular-nums ${
                      mio ? "text-black/40" : "text-white/40"
                    }`}
                  >
                    {hora(m.created_at)}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
        <div ref={finRef} />
      </ol>

      <form
        onSubmit={enviar}
        className="sticky bottom-0 flex items-end gap-2 border-t border-white/10 bg-black/95 py-3 backdrop-blur-md"
      >
        <label htmlFor="mensaje" className="sr-only">
          Escribe un mensaje
        </label>
        <textarea
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
          placeholder="Mensaje…"
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-white/20 bg-white/5 px-4 py-2.5 text-base outline-none transition-colors duration-200 focus:border-white"
        />
        <button
          type="submit"
          disabled={!texto.trim()}
          aria-label="Enviar mensaje"
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-black transition-opacity duration-200 hover:opacity-85 disabled:opacity-30"
        >
          <Send size={18} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
