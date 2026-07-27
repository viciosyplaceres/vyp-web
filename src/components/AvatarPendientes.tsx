"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
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

  useEffect(() => {
    // Quien todavía no está aprobado no tiene nada asignado: no hace falta
    // abrir un canal en tiempo real que nunca va a tener nada que contar.
    if (!esMiembro) return;

    const supabase = createClient();
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let cancelado = false;

    const refrescar = () => {
      obtenerPendientesPerfil()
        .then((n) => {
          if (!cancelado) setPendientes(n);
        })
        .catch(() => undefined);
    };

    (async () => {
      // Igual que en el chat: sin el token del usuario, Supabase no deja
      // pasar los eventos de tablas que solo pueden leer los miembros.
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await supabase.realtime.setAuth(data.session.access_token);
      }
      if (cancelado) return;

      canal = supabase
        .channel("pendientes-perfil-vyp")
        // Cuando la directiva marca/desmarca cualquier tarea o artículo
        // (o cuando yo mismo lo hago desde /perfil), o cuando me asignan o me
        // quitan algo nuevo, se recalcula el total.
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tareas" }, refrescar)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "lista_compra" }, refrescar)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "tareas_miembros", filter: `perfil_id=eq.${userId}` },
          refrescar,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "compra_miembros", filter: `perfil_id=eq.${userId}` },
          refrescar,
        )
        .subscribe();
    })();

    return () => {
      cancelado = true;
      if (canal) void supabase.removeChannel(canal);
    };
  }, [userId, esMiembro]);

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
