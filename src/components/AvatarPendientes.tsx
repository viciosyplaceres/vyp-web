"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { suscribirRealtime, type Escucha } from "@/lib/realtime";
import { obtenerPendientesPerfil } from "@/app/actions/pendientes";
import Avatar from "./Avatar";

/**
 * El avatar del header, con una burbuja roja de "tareas y compra pendientes"
 * que se actualiza en vivo. Es el único sitio donde vive este contador: el
 * botón de perfil del menú inferior se quitó por redundante (ver commit
 * anterior), así que el avatar es la única puerta de entrada a /perfil.
 *
 * No cuenta nada de música ni fotos, solo lo asignado en `tareas_miembros` y
 * `compra_miembros`: ahí sí existe un "pendiente/hecho" real que gestiona la
 * directiva, a diferencia de subir contenido.
 */
export default function AvatarPendientes({
  nombre,
  usuario,
  avatarUrl,
  userId,
  esMiembro,
  pendientesInicial,
}: {
  nombre: string | null;
  usuario: string | null;
  avatarUrl: string | null;
  userId: string;
  esMiembro: boolean;
  pendientesInicial: number;
}) {
  const [pendientes, setPendientes] = useState(pendientesInicial);

  // Cuando la directiva marca/desmarca cualquier tarea o artículo (o cuando
  // yo mismo lo hago desde /perfil), o cuando me asignan o me quitan algo
  // nuevo, se recalcula el total.
  const escuchas = useMemo<Escucha[]>(
    () => [
      { tabla: "tareas", evento: "UPDATE" },
      { tabla: "lista_compra", evento: "UPDATE" },
      { tabla: "tareas_miembros", evento: "*", filtro: `perfil_id=eq.${userId}` },
      { tabla: "compra_miembros", evento: "*", filtro: `perfil_id=eq.${userId}` },
    ],
    [userId],
  );

  useEffect(() => {
    // Quien todavía no está aprobado no tiene nada asignado: no hace falta
    // escuchar en tiempo real algo que nunca va a tener nada que contar.
    if (!esMiembro) return;

    let cancelado = false;
    const baja = suscribirRealtime(escuchas, () => {
      obtenerPendientesPerfil()
        .then((n) => {
          if (!cancelado) setPendientes(n);
        })
        .catch(() => undefined);
    });

    return () => {
      cancelado = true;
      baja();
    };
  }, [escuchas, esMiembro]);

  return (
    <Link
      href="/perfil"
      aria-label="Mi perfil"
      className="flex cursor-pointer items-center gap-2 rounded-full transition-opacity duration-200 hover:opacity-80"
    >
      <span className="hidden text-white/60 sm:block">
        {usuario ?? nombre ?? "Mi perfil"}
      </span>
      <span className="relative">
        <Avatar nombre={nombre} avatarUrl={avatarUrl} tamano={32} />
        {pendientes > 0 && (
          <span
            aria-label={`${pendientes} pendientes`}
            className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white"
          >
            {pendientes > 99 ? "99+" : pendientes}
          </span>
        )}
      </span>
    </Link>
  );
}
