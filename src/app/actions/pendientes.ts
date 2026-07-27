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

  const [{ data: tareas }, { data: compras }] = await Promise.all([
    supabase
      .from("tareas_miembros")
      .select("tareas!inner(hecha)")
      .eq("perfil_id", sesion.userId),
    supabase
      .from("compra_miembros")
      .select("lista_compra!inner(comprado)")
      .eq("perfil_id", sesion.userId),
  ]);

  type ConHecha = { tareas: { hecha: boolean } | { hecha: boolean }[] | null };
  type ConComprado = {
    lista_compra: { comprado: boolean } | { comprado: boolean }[] | null;
  };

  const tareasPendientes = (tareas as ConHecha[] | null ?? []).filter((f) => {
    const rel = Array.isArray(f.tareas) ? f.tareas[0] : f.tareas;
    return rel && !rel.hecha;
  }).length;

  const comprasPendientes = (compras as ConComprado[] | null ?? []).filter((f) => {
    const rel = Array.isArray(f.lista_compra) ? f.lista_compra[0] : f.lista_compra;
    return rel && !rel.comprado;
  }).length;

  return tareasPendientes + comprasPendientes;
}
