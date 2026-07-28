"use client";

import { useEffect, useRef } from "react";
import { suscribirRealtime, type CambioPostgres, type Escucha } from "@/lib/realtime";
import { marcarChatLeido } from "@/app/actions/chat";
import type { InfoAutor, Mensaje, Reaccion } from "./tipos";

const ESCUCHAS: Escucha[] = [
  { tabla: "mensajes", evento: "INSERT" },
  { tabla: "mensajes", evento: "UPDATE" },
  { tabla: "mensajes", evento: "DELETE" },
  { tabla: "mensaje_reacciones", evento: "*" },
  { tabla: "chat_lecturas", evento: "*" },
];

type FilaMensaje = Partial<Mensaje> & {
  respuesta_a?: string | null;
  respuesta_texto?: string | null;
  respuesta_autor?: string | null;
  editado_at?: string | null;
  borrado?: boolean;
};

/**
 * Escucha en vivo del chat: mensajes nuevos, ediciones, borrados, reacciones
 * y marcas de lectura de los demás, todo sin recargar la página.
 *
 * Va por el canal único de la app (`lib/realtime`), no por uno propio: la
 * burbuja de no leídos del menú inferior escucha la misma tabla y antes cada
 * mensaje viajaba dos veces.
 */
export function useRealtimeChat({
  userId,
  autores,
  setMensajes,
  setReacciones,
  setLecturas,
}: {
  userId: string;
  autores: Record<string, InfoAutor>;
  setMensajes: React.Dispatch<React.SetStateAction<Mensaje[]>>;
  setReacciones: React.Dispatch<React.SetStateAction<Record<string, Reaccion[]>>>;
  setLecturas: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  // El índice de autores cambia de identidad en cada render del servidor. Si
  // fuera dependencia del efecto, el canal se cerraría y reabriría sin parar.
  const autoresRef = useRef(autores);
  useEffect(() => {
    autoresRef.current = autores;
  }, [autores]);

  useEffect(() => {
    function alCambio(escucha: Escucha, cambio: CambioPostgres) {
      if (escucha.tabla === "mensajes" && escucha.evento === "INSERT") {
        const m = cambio.new as FilaMensaje | null;
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

        // Si el chat está abierto cuando llega un mensaje ajeno, se considera
        // leído al instante: el que escribe ve su check azul sin que el
        // receptor tenga que hacer nada más.
        if (m.autor_id !== userId) {
          marcarChatLeido().catch(() => undefined);
        }
        return;
      }

      if (escucha.tabla === "mensajes" && escucha.evento === "UPDATE") {
        const m = cambio.new as FilaMensaje | null;
        if (!m?.id) return;
        setMensajes((prev) =>
          prev.map((x) =>
            x.id === m.id
              ? {
                  ...x,
                  texto: m.texto ?? x.texto,
                  borrado: m.borrado ?? x.borrado,
                  editadoAt: m.editado_at ?? null,
                }
              : x,
          ),
        );
        return;
      }

      if (escucha.tabla === "mensajes" && escucha.evento === "DELETE") {
        const m = cambio.old as { id?: string } | null;
        if (!m?.id) return;
        setMensajes((prev) => prev.filter((mensaje) => mensaje.id !== m.id));
        setReacciones((prev) => {
          const siguientes = { ...prev };
          delete siguientes[m.id!];
          return siguientes;
        });
        return;
      }

      if (escucha.tabla === "mensaje_reacciones") {
        const fila = (cambio.new ?? cambio.old) as {
          mensaje_id?: string;
          perfil_id?: string;
          emoji?: string;
        } | null;
        if (!fila?.mensaje_id) return;
        const mensajeId = fila.mensaje_id;

        setReacciones((prev) => {
          const resto = (prev[mensajeId] ?? []).filter((r) => r.perfilId !== fila.perfil_id);
          const lista =
            cambio.eventType === "DELETE"
              ? resto
              : [
                  ...resto,
                  {
                    emoji: fila.emoji ?? "",
                    perfilId: fila.perfil_id ?? "",
                    nombre: autoresRef.current[fila.perfil_id ?? ""]?.nombre ?? null,
                  },
                ];
          return { ...prev, [mensajeId]: lista };
        });
        return;
      }

      const fila = (cambio.new ?? cambio.old) as {
        perfil_id?: string;
        ultimo_leido_at?: string;
      } | null;
      if (!fila?.perfil_id) return;
      const perfilId = fila.perfil_id;
      if (cambio.eventType === "DELETE") {
        setLecturas((prev) => {
          const siguientes = { ...prev };
          delete siguientes[perfilId];
          return siguientes;
        });
        return;
      }
      if (!fila.ultimo_leido_at) return;
      const marca = fila.ultimo_leido_at;
      setLecturas((prev) => ({ ...prev, [perfilId]: marca }));
    }

    return suscribirRealtime(ESCUCHAS, alCambio);
  }, [userId, setMensajes, setReacciones, setLecturas]);
}
