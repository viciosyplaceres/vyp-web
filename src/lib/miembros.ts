import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

export type MiembroListado = {
  id: string;
  nombre: string | null;
  usuario: string | null;
  avatarUrl: string | null;
};

/**
 * La lista de miembros aprobados, con su avatar, para todas las pantallas de
 * gestión (repartir tareas, la compra, tallas, pagos, deudas…).
 *
 * Va con el cliente de servicio a propósito. La política RLS de `perfiles` es
 * `id = auth.uid() or es_admin()`: correcta, porque ahí viven el rol y la
 * aprobación de cada uno, pero significa que un miembro normal **no puede
 * leer la fila de nadie más**. Como la gestión ya no es solo de la directiva,
 * estas pantallas se quedarían con la lista vacía —que es justo el fallo que
 * habría aparecido al abrirlas—. Aquí se exponen solo cuatro columnas que ya
 * son públicas en la vista `autores` (nombre, usuario, avatar), nunca el rol
 * ni si está aprobado.
 *
 * Envuelta en `cache()`: varias pantallas la piden más de una vez por render
 * y no tiene sentido repetir la consulta dentro de la misma petición.
 */
export const listarMiembros = cache(async (): Promise<MiembroListado[]> => {
  const { data } = await createAdminClient()
    .from("perfiles")
    .select("id, nombre, usuario, avatar_url")
    .eq("aprobado", true)
    .order("nombre", { ascending: true });

  return (data ?? []).map((m) => ({
    id: m.id,
    nombre: m.nombre,
    usuario: m.usuario,
    avatarUrl: m.avatar_url,
  }));
});

/**
 * Los mismos miembros indexados por id, para cruzar asignaciones en memoria.
 *
 * Las tablas puente (`compra_miembros`, `tareas_miembros`) traían el perfil
 * con un join anidado, y eso ahora devolvería vacío para quien no sea admin
 * por la RLS de `perfiles`. Se piden solo los ids y se cruzan contra este
 * índice, que sí está resuelto con el cliente de servicio.
 */
export const indiceMiembros = cache(async (): Promise<Map<string, MiembroListado>> => {
  const lista = await listarMiembros();
  return new Map(lista.map((m) => [m.id, m]));
});

/** Nombre con el que se enseña a alguien, con respaldos por si falta. */
export function nombreVisible(m: {
  nombre?: string | null;
  usuario?: string | null;
}): string {
  return m.nombre || m.usuario || "Miembro";
}
