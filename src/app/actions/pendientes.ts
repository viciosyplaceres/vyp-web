"use server";

import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";

/**
 * Cuántas cosas tiene pendientes el miembro conectado: tareas de la peña que
 * le tocan a él (no marcadas como hechas) más artículos de la lista de la
 * compra que le tocan a él (no marcados como comprados). Es el número que se
 * ve en la burbuja del avatar del header, en tiempo real.
 *
 * No incluye música ni fotos a propósito: ahí no existe el concepto de
 * "pendiente", solo de "subido".
 */
export async function obtenerPendientesPerfil(): Promise<number> {
  const sesion = await getSesion();
  if (!sesion?.esMiembro) return 0;

  const supabase = await createClient();

  // Se pide el número, no las filas: antes se descargaba cada asignación del
  // miembro (con su tarea o su artículo dentro) solo para contarlas con un
  // `filter().length` en memoria. La base de datos ya sabe contar, y filtrar
  // por la tabla relacionada es lo que hace `!inner` + `eq`.
  const [{ count: tareasPendientes }, { count: comprasPendientes }] = await Promise.all([
    supabase
      .from("tareas_miembros")
      .select("tareas!inner(hecha)", { count: "exact", head: true })
      .eq("perfil_id", sesion.userId)
      .eq("tareas.hecha", false),
    supabase
      .from("compra_miembros")
      .select("lista_compra!inner(comprado)", { count: "exact", head: true })
      .eq("perfil_id", sesion.userId)
      .eq("lista_compra.comprado", false),
  ]);

  return (tareasPendientes ?? 0) + (comprasPendientes ?? 0);
}
