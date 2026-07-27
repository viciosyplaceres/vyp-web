"use client";

import {
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { Send, Reply, Pencil, Trash2, SmilePlus, X, Check, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  enviarMensaje,
  editarMensaje,
  borrarMensaje,
  reaccionar,
  marcarChatLeido,
} from "@/app/actions/chat";
import Avatar from "./Avatar";
import AvisosPush from "./AvisosPush";

export type Mensaje = {
  id: string;
  texto: string;
  created_at: string;
  autor_id: string;
  autor: string | null;
  avatarUrl: string | null;
  respuestaA: string | null;
  respuestaTexto: string | null;
  respuestaAutor: string | null;
  editadoAt: string | null;
  borrado: boolean;
};

export type InfoAutor = { nombre: string | null; avatarUrl: string | null };
type Reaccion = { emoji: string; perfilId: string; nombre: string | null };

const EMOJIS_RAPIDOS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const EMOJIS_PICKER = [
  "😀", "😂", "😍", "🥳", "😎", "😢", "😮", "😡", "👍", "👎",
  "🙏", "👏", "🎉", "🔥", "❤️", "💯", "🤝", "🍻", "⚽", "🎶",
  "😅", "🤔", "😴", "🥴", "😇", "🫡", "✅", "❌", "⏰", "📌",
];

function hora(iso: string) {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return "";
  return f.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
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
  autores,
  reaccionesIniciales,
  lecturasIniciales,
}: {
  inicial: Mensaje[];
  userId: string;
  autores: Record<string, InfoAutor>;
  reaccionesIniciales: Record<string, Reaccion[]>;
  lecturasIniciales: Record<string, string>;
}) {
  const [mensajes, setMensajes] = useState<Mensaje[]>(inicial);
  const [reacciones, setReacciones] = useState(reaccionesIniciales);
  const [lecturas, setLecturas] = useState(lecturasIniciales);
  const [texto, setTexto] = useState("");
  const [respondiendoA, setRespondiendoA] = useState<Mensaje | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [picketaAbierta, setPicketaAbierta] = useState<string | null>(null);
  const [mostrarEmojisTexto, setMostrarEmojisTexto] = useState(false);
  const [, startTransition] = useTransition();
  const finRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [optimistas, addOptimista] = useOptimistic(
    mensajes,
    (estado, nuevo: Mensaje) => [...estado, nuevo],
  );

  const mensajesPorId = useMemo(() => {
    const mapa = new Map<string, Mensaje>();
    for (const m of optimistas) mapa.set(m.id, m);
    return mapa;
  }, [optimistas]);

  // El índice de autores cambia de identidad en cada render del servidor. Si
  // fuera dependencia del efecto, el canal se cerraría y reabriría sin parar.
  const autoresRef = useRef(autores);
  useEffect(() => {
    autoresRef.current = autores;
  }, [autores]);

  // Escucha en vivo: mensajes nuevos, ediciones, borrados, reacciones y
  // marcas de lectura de los demás, todo sin recargar la página.
  useEffect(() => {
    const supabase = createClient();
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let cancelado = false;

    (async () => {
      // IMPRESCINDIBLE: el canal se conecta con la clave pública, y estas
      // tablas solo las pueden leer los miembros. Sin pasarle el token del
      // usuario, Supabase entrega los eventos vacíos con "Error 401".
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
            const m = payload.new as Partial<Mensaje> & {
              respuesta_a?: string | null;
              respuesta_texto?: string | null;
              respuesta_autor?: string | null;
              editado_at?: string | null;
            } | null;
            if (!m?.id || !m.created_at) return;

            setMensajes((prev) => {
              if (prev.some((x) => x.id === m.id)) return prev;
              const info = autoresRef.current[m.autor_id ?? ""];
              return [
                ...prev,
                {
                  id: m.id!,
                  texto: m.texto ?? "",
                  created_at: m.created_at!,
                  autor_id: m.autor_id ?? "",
                  autor: info?.nombre ?? null,
                  avatarUrl: info?.avatarUrl ?? null,
                  respuestaA: m.respuesta_a ?? null,
                  respuestaTexto: m.respuesta_texto ?? null,
                  respuestaAutor: m.respuesta_autor ?? null,
                  editadoAt: m.editado_at ?? null,
                  borrado: false,
                },
              ];
            });

            // Si el chat está abierto cuando llega un mensaje ajeno, se
            // considera leído al instante: el que escribe ve su check azul
            // sin que el receptor tenga que hacer nada más.
            if (m.autor_id !== userId) {
              marcarChatLeido().catch(() => undefined);
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "mensajes" },
          (payload) => {
            const m = payload.new as Mensaje & {
              editado_at?: string | null;
            };
            setMensajes((prev) =>
              prev.map((x) =>
                x.id === m.id
                  ? {
                      ...x,
                      texto: m.texto,
                      borrado: (m as unknown as { borrado: boolean }).borrado,
                      editadoAt: m.editado_at ?? null,
                    }
                  : x,
              ),
            );
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "mensaje_reacciones" },
          (payload) => {
            const fila = (payload.new ?? payload.old) as {
              mensaje_id: string;
              perfil_id: string;
              emoji: string;
            } | null;
            if (!fila?.mensaje_id) return;

            setReacciones((prev) => {
              const resto = (prev[fila.mensaje_id] ?? []).filter(
                (r) => r.perfilId !== fila.perfil_id,
              );
              const lista =
                payload.eventType === "DELETE"
                  ? resto
                  : [
                      ...resto,
                      {
                        emoji: fila.emoji,
                        perfilId: fila.perfil_id,
                        nombre: autoresRef.current[fila.perfil_id]?.nombre ?? null,
                      },
                    ];
              return { ...prev, [fila.mensaje_id]: lista };
            });
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "chat_lecturas" },
          (payload) => {
            const fila = payload.new as { perfil_id: string; ultimo_leido_at: string } | null;
            if (!fila?.perfil_id) return;
            setLecturas((prev) => ({ ...prev, [fila.perfil_id]: fila.ultimo_leido_at }));
          },
        )
        .subscribe();
    })();

    return () => {
      cancelado = true;
      if (canal) void supabase.removeChannel(canal);
    };
  }, [userId]);

  // Siempre abajo, como en cualquier app de mensajería.
  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [optimistas.length]);

  function enfocarTextarea() {
    queueMicrotask(() => textareaRef.current?.focus());
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio) return;

    const respuesta = respondiendoA;
    setTexto("");
    setRespondiendoA(null);
    setMostrarEmojisTexto(false);

    startTransition(async () => {
      addOptimista({
        id: `temp-${Date.now()}`,
        texto: limpio,
        created_at: new Date().toISOString(),
        autor_id: userId,
        autor: null,
        avatarUrl: null,
        respuestaA: respuesta?.id ?? null,
        respuestaTexto: respuesta ? (respuesta.borrado ? "Mensaje eliminado" : respuesta.texto) : null,
        respuestaAutor: respuesta?.autor ?? null,
        editadoAt: null,
        borrado: false,
      });

      // Se añade la fila devuelta por el servidor en vez de esperar al canal
      // en vivo: el mensaje propio nunca depende de que el tiempo real llegue.
      const creado = await enviarMensaje(limpio, respuesta?.id ?? null);
      if (creado) {
        setMensajes((prev) =>
          prev.some((x) => x.id === creado.id)
            ? prev
            : [
                ...prev,
                {
                  id: creado.id,
                  texto: creado.texto,
                  created_at: creado.created_at,
                  autor_id: creado.autor_id,
                  autor: creado.autor,
                  avatarUrl: creado.avatarUrl,
                  respuestaA: creado.respuestaA,
                  respuestaTexto: creado.respuestaTexto,
                  respuestaAutor: creado.respuestaAutor,
                  editadoAt: creado.editadoAt,
                  borrado: creado.borrado,
                },
              ],
        );
      }
    });
  }

  function empezarEdicion(m: Mensaje) {
    setEditandoId(m.id);
    setRespondiendoA(null);
    setTexto(m.texto);
    enfocarTextarea();
  }

  function guardarEdicion(e: React.FormEvent) {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio || !editandoId) return;

    const id = editandoId;
    setMensajes((prev) =>
      prev.map((x) =>
        x.id === id ? { ...x, texto: limpio, editadoAt: new Date().toISOString() } : x,
      ),
    );
    setEditandoId(null);
    setTexto("");

    startTransition(async () => {
      await editarMensaje(id, limpio).catch(() => undefined);
    });
  }

  function eliminar(id: string) {
    setMensajes((prev) =>
      prev.map((x) => (x.id === id ? { ...x, borrado: true } : x)),
    );
    startTransition(async () => {
      await borrarMensaje(id).catch(() => undefined);
    });
  }

  function alternarReaccion(mensajeId: string, emoji: string) {
    setPicketaAbierta(null);
    setReacciones((prev) => {
      const actuales = prev[mensajeId] ?? [];
      const mia = actuales.find((r) => r.perfilId === userId);
      const resto = actuales.filter((r) => r.perfilId !== userId);
      const lista = mia?.emoji === emoji ? resto : [...resto, { emoji, perfilId: userId, nombre: null }];
      return { ...prev, [mensajeId]: lista };
    });
    startTransition(async () => {
      await reaccionar(mensajeId, emoji).catch(() => undefined);
    });
  }

  function insertarEmoji(emoji: string) {
    setTexto((prev) => prev + emoji);
    enfocarTextarea();
  }

  // "Leído" cuando algún otro miembro tiene marcado como leído hasta una
  // fecha igual o posterior a la del mensaje.
  function loHaLeidoAlguien(mensaje: Mensaje) {
    return Object.entries(lecturas).some(
      ([perfilId, marca]) => perfilId !== userId && new Date(marca) >= new Date(mensaje.created_at),
    );
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
          const esTemporal = m.id.startsWith("temp-");
          const reaccionesMsg = reacciones[m.id] ?? [];
          const grupos = new Map<string, Reaccion[]>();
          for (const r of reaccionesMsg) {
            (grupos.get(r.emoji) ?? grupos.set(r.emoji, []).get(r.emoji)!).push(r);
          }
          const original = m.respuestaA ? mensajesPorId.get(m.respuestaA) : null;

          return (
            <li key={m.id} className="group/msg relative">
              {separador && (
                <p className="my-4 text-center text-[11px] uppercase tracking-wider text-white/30">
                  {dia}
                </p>
              )}
              <div
                className={`flex items-end gap-2 ${mio ? "justify-end" : "justify-start"}`}
              >
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
                            {original?.autor_id === userId
                              ? "Tú"
                              : m.respuestaAutor ?? "Miembro"}
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
                        <span>{hora(m.created_at)}</span>
                        {mio && !esTemporal && (
                          loHaLeidoAlguien(m) ? (
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
                          onClick={() => setPicketaAbierta(picketaAbierta === m.id ? null : m.id)}
                          aria-label="Reaccionar"
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-sm transition-colors duration-150 hover:bg-white/20 hover:text-white"
                        >
                          <SmilePlus size={15} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRespondiendoA(m);
                            setEditandoId(null);
                            enfocarTextarea();
                          }}
                          aria-label="Responder"
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-sm transition-colors duration-150 hover:bg-white/20 hover:text-white"
                        >
                          <Reply size={15} aria-hidden="true" />
                        </button>
                        {mio && (
                          <>
                            <button
                              type="button"
                              onClick={() => empezarEdicion(m)}
                              aria-label="Editar"
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-sm transition-colors duration-150 hover:bg-white/20 hover:text-white"
                            >
                              <Pencil size={14} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => eliminar(m.id)}
                              aria-label="Eliminar"
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-sm transition-colors duration-150 hover:bg-red-500/20 hover:text-red-400"
                            >
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {picketaAbierta === m.id && (
                      <div
                        className={`absolute top-full z-10 mt-1 flex gap-1 rounded-full border border-white/15 bg-neutral-900 px-2 py-1.5 shadow-lg ${
                          mio ? "right-0" : "left-0"
                        }`}
                      >
                        {EMOJIS_RAPIDOS.map((e) => (
                          <button
                            key={e}
                            type="button"
                            onClick={() => alternarReaccion(m.id, e)}
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
                          onClick={() => alternarReaccion(m.id, emoji)}
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
            </li>
          );
        })}
        <div ref={finRef} />
      </ol>

      {/* En móvil se separa del fondo lo que mide la barra de navegación
          inferior (56px + zona segura del teléfono); en escritorio no hay
          barra inferior, así que se pega abajo del todo. */}
      <div className="sticky bottom-[calc(56px+env(safe-area-inset-bottom))] border-t border-white/10 bg-black/95 backdrop-blur-md md:bottom-0">
        {respondiendoA && (
          <div className="flex items-center gap-2 border-b border-white/10 px-1 pt-2">
            <div className="min-w-0 flex-1 rounded-lg border-l-2 border-white/30 bg-white/5 px-2.5 py-1.5 text-xs">
              <p className="font-medium text-white/70">
                Respondiendo a {respondiendoA.autor_id === userId ? "ti mismo" : respondiendoA.autor ?? "Miembro"}
              </p>
              <p className="truncate text-white/50">
                {respondiendoA.borrado ? "Mensaje eliminado" : respondiendoA.texto}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRespondiendoA(null)}
              aria-label="Cancelar respuesta"
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/50 hover:text-white"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        )}

        {editandoId && (
          <div className="flex items-center gap-2 border-b border-white/10 px-1 pt-2">
            <p className="flex-1 text-xs font-medium text-white/60">Editando mensaje</p>
            <button
              type="button"
              onClick={() => {
                setEditandoId(null);
                setTexto("");
              }}
              aria-label="Cancelar edición"
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/50 hover:text-white"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        )}

        {mostrarEmojisTexto && (
          <div className="grid grid-cols-10 gap-1 border-b border-white/10 px-2 py-2">
            {EMOJIS_PICKER.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => insertarEmoji(e)}
                className="cursor-pointer rounded-lg p-1.5 text-xl transition-colors duration-100 hover:bg-white/10"
              >
                {e}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={editandoId ? guardarEdicion : enviar}
          className="flex items-end gap-2 py-3"
        >
          <button
            type="button"
            onClick={() => setMostrarEmojisTexto((v) => !v)}
            aria-label="Emojis"
            className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ${
              mostrarEmojisTexto ? "bg-white/15 text-white" : "text-white/50 hover:text-white"
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
                if (editandoId) guardarEdicion(e);
                else enviar(e);
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder={editandoId ? "Edita tu mensaje…" : "Mensaje…"}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-white/20 bg-white/5 px-4 py-2.5 text-base outline-none transition-colors duration-200 focus:border-white"
          />
          <button
            type="submit"
            disabled={!texto.trim()}
            aria-label={editandoId ? "Guardar edición" : "Enviar mensaje"}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-black transition-opacity duration-200 hover:opacity-85 disabled:opacity-30"
          >
            {editandoId ? <Check size={18} aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
          </button>
        </form>
      </div>
    </div>
  );
}
