"use client";

import { useCallback, useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import {
  enviarMensaje,
  editarMensaje,
  borrarMensaje,
  reaccionar,
} from "@/app/actions/chat";
import { diaRelativo } from "@/lib/formato";
import BurbujaMensaje from "./chat/BurbujaMensaje";
import BarraEscritura from "./chat/BarraEscritura";
import { useRealtimeChat } from "./chat/useRealtimeChat";
import type { InfoAutor, Mensaje, Reaccion } from "./chat/tipos";

export type { Mensaje, InfoAutor } from "./chat/tipos";

const SIN_REACCIONES: Reaccion[] = [];

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
  const [respondiendoA, setRespondiendoA] = useState<Mensaje | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [picketaAbierta, setPicketaAbierta] = useState<string | null>(null);
  const [pedirFoco, setPedirFoco] = useState(0);
  const [, startTransition] = useTransition();
  const finRef = useRef<HTMLDivElement>(null);

  const [optimistas, addOptimista] = useOptimistic(
    mensajes,
    (estado, nuevo: Mensaje) => [...estado, nuevo],
  );

  const mensajesPorId = useMemo(() => {
    const mapa = new Map<string, Mensaje>();
    for (const m of optimistas) mapa.set(m.id, m);
    return mapa;
  }, [optimistas]);

  useRealtimeChat({ userId, autores, setMensajes, setReacciones, setLecturas });

  // Siempre abajo, como en cualquier app de mensajería.
  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [optimistas.length]);

  const enviar = useCallback(
    (limpio: string) => {
      const respuesta = respondiendoA;
      setRespondiendoA(null);

      startTransition(async () => {
        addOptimista({
          id: `temp-${Date.now()}`,
          texto: limpio,
          created_at: new Date().toISOString(),
          autor_id: userId,
          autor: null,
          avatarUrl: null,
          respuestaA: respuesta?.id ?? null,
          respuestaTexto: respuesta
            ? respuesta.borrado
              ? "Mensaje eliminado"
              : respuesta.texto
            : null,
          respuestaAutor: respuesta?.autor ?? null,
          editadoAt: null,
          borrado: false,
        });

        // Se añade la fila devuelta por el servidor en vez de esperar al canal
        // en vivo: el mensaje propio nunca depende de que el tiempo real llegue.
        const creado = await enviarMensaje(limpio, respuesta?.id ?? null);
        if (creado) {
          setMensajes((prev) =>
            prev.some((x) => x.id === creado.id) ? prev : [...prev, creado],
          );
        }
      });
    },
    [respondiendoA, userId, addOptimista],
  );

  const guardarEdicion = useCallback(
    (limpio: string) => {
      const id = editandoId;
      if (!id) return;

      setMensajes((prev) =>
        prev.map((x) =>
          x.id === id ? { ...x, texto: limpio, editadoAt: new Date().toISOString() } : x,
        ),
      );
      setEditandoId(null);

      startTransition(async () => {
        await editarMensaje(id, limpio).catch(() => undefined);
      });
    },
    [editandoId],
  );

  const eliminar = useCallback((id: string) => {
    setMensajes((prev) => prev.map((x) => (x.id === id ? { ...x, borrado: true } : x)));
    startTransition(async () => {
      await borrarMensaje(id).catch(() => undefined);
    });
  }, []);

  const alternarReaccion = useCallback(
    (mensajeId: string, emoji: string) => {
      setPicketaAbierta(null);
      setReacciones((prev) => {
        const actuales = prev[mensajeId] ?? [];
        const mia = actuales.find((r) => r.perfilId === userId);
        const resto = actuales.filter((r) => r.perfilId !== userId);
        const lista =
          mia?.emoji === emoji ? resto : [...resto, { emoji, perfilId: userId, nombre: null }];
        return { ...prev, [mensajeId]: lista };
      });
      startTransition(async () => {
        await reaccionar(mensajeId, emoji).catch(() => undefined);
      });
    },
    [userId],
  );

  const responder = useCallback((m: Mensaje) => {
    setRespondiendoA(m);
    setEditandoId(null);
    setPedirFoco((n) => n + 1);
  }, []);

  const empezarEdicion = useCallback((m: Mensaje) => {
    setEditandoId(m.id);
    setRespondiendoA(null);
    setPedirFoco((n) => n + 1);
  }, []);

  const alternarPicker = useCallback((id: string) => {
    setPicketaAbierta((abierta) => (abierta === id ? null : id));
  }, []);

  // "Leído" cuando algún otro miembro tiene marcado como leído hasta una
  // fecha igual o posterior a la del mensaje. Se calcula la marca más
  // reciente de los demás una sola vez, no por mensaje.
  const leidoHasta = useMemo(() => {
    let max = 0;
    for (const [perfilId, marca] of Object.entries(lecturas)) {
      if (perfilId === userId) continue;
      max = Math.max(max, new Date(marca).getTime());
    }
    return max;
  }, [lecturas, userId]);

  // Se calcula antes de pintar en qué mensajes toca separador de día, para no
  // ir mutando una variable durante el render.
  const conSeparador = optimistas.map((m, i) => {
    const dia = diaRelativo(m.created_at);
    const anterior = i > 0 ? diaRelativo(optimistas[i - 1].created_at) : null;
    return { mensaje: m, dia, separador: dia !== anterior };
  });

  const editando = editandoId ? mensajesPorId.get(editandoId) ?? null : null;

  return (
    <div className="flex flex-1 flex-col">
      <ol className="flex-1 space-y-2 py-4">
        {optimistas.length === 0 && (
          <li className="py-10 text-center text-sm text-white/40">
            Aún no hay mensajes. Escribe el primero.
          </li>
        )}

        {conSeparador.map(({ mensaje: m, dia, separador }) => (
          <li key={m.id} className="group/msg relative">
            {separador && (
              <p className="my-4 text-center text-[11px] uppercase tracking-wider text-white/30">
                {dia}
              </p>
            )}
            <BurbujaMensaje
              mensaje={m}
              mio={m.autor_id === userId}
              userId={userId}
              reacciones={reacciones[m.id] ?? SIN_REACCIONES}
              autorOriginalEsMio={
                !!m.respuestaA && mensajesPorId.get(m.respuestaA)?.autor_id === userId
              }
              leido={leidoHasta >= new Date(m.created_at).getTime()}
              pickerAbierto={picketaAbierta === m.id}
              onAlternarPicker={alternarPicker}
              onReaccionar={alternarReaccion}
              onResponder={responder}
              onEditar={empezarEdicion}
              onEliminar={eliminar}
            />
          </li>
        ))}
        <div ref={finRef} />
      </ol>

      <BarraEscritura
        key={editandoId ?? "nuevo"}
        respondiendoA={respondiendoA}
        editando={editando}
        userId={userId}
        pedirFoco={pedirFoco}
        onCancelarRespuesta={() => setRespondiendoA(null)}
        onCancelarEdicion={() => setEditandoId(null)}
        onEnviar={enviar}
        onGuardarEdicion={guardarEdicion}
      />
    </div>
  );
}
