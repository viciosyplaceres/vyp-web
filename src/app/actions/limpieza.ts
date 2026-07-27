"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/auth";
import { listarMiembros } from "@/lib/miembros";
import { sortearLimpieza, type Tirada } from "@/lib/limpieza";

export type ResultadoTirada = {
  /** El guion de tiradas, para animar los dados tal y como cayeron. */
  tiradas: Tirada[];
  caras: number;
  /** Qué número le tocó a cada miembro en el dado. */
  numeros: { perfilId: string; nombre: string | null; numero: number }[];
};

/**
 * Tira los dados y guarda el reparto de la limpieza.
 *
 * El sorteo se hace **en el servidor** a propósito, no en el navegador: es el
 * reparto oficial de la peña, así que no puede depender de la máquina de
 * quien pulsa el botón ni ser repetible hasta que salga algo que le convenga.
 * Lo que se devuelve al navegador es el guion completo de tiradas —incluidas
 * las que no valieron— para que la animación enseñe exactamente lo que pasó,
 * no una recreación inventada.
 */
export async function tirarDadosLimpieza(anio: number): Promise<ResultadoTirada> {
  await exigirAdmin();

  const miembros = await listarMiembros();
  const resultado = sortearLimpieza(miembros.length, anio);

  const supabase = await createClient();

  // Se rehace el reparto entero del año: volver a tirar los dados sustituye
  // al sorteo anterior, no se acumula encima.
  await supabase.from("limpieza_turnos").delete().eq("anio", anio);
  await supabase.from("limpieza_numeros").delete().eq("anio", anio);

  const numeros = miembros.map((m, i) => ({
    perfilId: m.id,
    nombre: m.nombre,
    numero: i + 1,
  }));

  const { error: errorNumeros } = await supabase.from("limpieza_numeros").insert(
    numeros.map((n) => ({ anio, perfil_id: n.perfilId, numero: n.numero })),
  );
  if (errorNumeros) throw new Error(errorNumeros.message);

  const filas: { anio: number; fecha: string; perfil_id: string }[] = [];
  for (const [fecha, indices] of resultado.porFecha) {
    for (const i of indices) {
      filas.push({ anio, fecha, perfil_id: miembros[i].id });
    }
  }

  const { error } = await supabase.from("limpieza_turnos").insert(filas);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/limpieza");
  revalidatePath("/perfil");

  return { tiradas: resultado.tiradas, caras: resultado.caras, numeros };
}

/** Borra el reparto de un año, por si hay que empezar de cero. */
export async function borrarSorteoLimpieza(anio: number) {
  await exigirAdmin();
  const supabase = await createClient();

  await supabase.from("limpieza_turnos").delete().eq("anio", anio);
  await supabase.from("limpieza_numeros").delete().eq("anio", anio);

  revalidatePath("/admin/limpieza");
  revalidatePath("/perfil");
}
