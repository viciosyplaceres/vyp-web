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
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return "";
  return f.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function diaLegible(iso: string) {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return "";
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

  // El índice de nombres cambia de identidad en cada render del servidor. Si
  // fuera dependencia del efecto, el canal se cerraría y reabriría sin parar.
  const nombresRef = useRef(nombres);
  useEffect(() => {
    nombresRef.current = nombres;
  }, [nombres]);

  // Escucha en vivo: los mensajes de los demás aparecen sin recargar.
  useEffect(() => {
    const supabase = createClient();
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let cancelado = false;

    (async () => {
      // IMPRESCINDIBLE: el canal se conecta con la clave pública, y la tabla
      // `mensajes` solo la pueden leer los miembros. Sin pasarle el token del
      // usuario, Supabase entrega el evento con el registro VACÍO y un
      // "Error 401: Unauthorized" — que es justo lo que salía en pantalla como
      // "Invalid Date" y autor "Miembro".
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await supabase.realtime.setAuth(data.session.access_token);
      }
      if (cancelado) return;

      canal = supabase
        .channel("chat-vyp")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "mensajes" },
          (payload) => {
            const m = payload.new as Partial<Mensaje> | null;

            // Cinturón y tirantes: si por lo que sea el registro llega vacío,
            // se descarta en vez de pintar una burbuja rota.
            if (!m?.id || !m.created_at) return;

            setMensajes((prev) =>
              prev.some((x) => x.id === m.id)
                ? prev
                : [
                    ...prev,
                    {
                      id: m.id!,
                      texto: m.texto ?? "",
                      created_at: m.created_at!,
                      autor_id: m.autor_id ?? "",
                      autor: nombresRef.current[m.autor_id ?? ""] ?? null,
                    },
                  ],
            );
          },
        )
        .subscribe();
    })();

    return () => {
      cancelado = true;
      if (canal) void supabase.removeChannel(canal);
    };
  }, []);

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

      // Se añade la fila devuelta por el servidor en vez de esperar al canal
      // en vivo: el mensaje propio nunca depende de que el tiempo real llegue.
      const creado = await enviarMensaje(limpio);
      if (creado) {
        setMensajes((prev) =>
          prev.some((x) => x.id === creado.id) ? prev : [...prev, creado],
        );
      }
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

      {/* En móvil se separa del fondo lo que mide la barra de navegación
          inferior (56px + zona segura del teléfono); en escritorio no hay
          barra inferior, así que se pega abajo del todo. */}
      <form
        onSubmit={enviar}
        className="sticky bottom-[calc(56px+env(safe-area-inset-bottom))] flex items-end gap-2 border-t border-white/10 bg-black/95 py-3 backdrop-blur-md md:bottom-0"
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
