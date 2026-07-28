"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserIdValidado } from "@/lib/auth";

export type ContadoresNavegacion = {
  noLeidos: number;
  pendientes: number;
};

/** Los dos indicadores globales del menú, resueltos en una sola llamada SQL. */
export async function obtenerContadoresNavegacion(): Promise<ContadoresNavegacion> {
  if (!(await getUserIdValidado())) return { noLeidos: 0, pendientes: 0 };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("contadores_navegacion").maybeSingle();

  if (error) throw new Error(error.message);
  const fila = data as { no_leidos?: number | string; pendientes?: number | string } | null;
  return {
    noLeidos: Number(fila?.no_leidos ?? 0),
    pendientes: Number(fila?.pendientes ?? 0),
  };
}
