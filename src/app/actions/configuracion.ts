"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/auth";

/**
 * El año en el que está trabajando la peña ahora mismo. Lo fija la directiva
 * una vez (normalmente al empezar a preparar las fiestas siguientes) y a
 * partir de ahí Tareas, Participantes y la Compra lo usan por defecto, sin
 * tener que volver a elegirlo cada vez.
 */
export async function obtenerAnioActivo(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("configuracion")
    .select("anio_activo")
    .eq("id", true)
    .single();

  return data?.anio_activo ?? new Date().getFullYear();
}

export async function actualizarAnioActivo(anio: number) {
  await exigirAdmin();

  if (!Number.isInteger(anio) || anio < 2010 || anio > 2100) {
    throw new Error("Año no válido.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("configuracion")
    .update({ anio_activo: anio })
    .eq("id", true);

  if (error) throw new Error(error.message);

  // Todo lo que depende del año activo se refresca de golpe.
  revalidatePath("/admin");
  revalidatePath("/admin/tareas");
  revalidatePath("/admin/camisetas");
  revalidatePath("/admin/pagos");
  revalidatePath("/admin/compras");
  revalidatePath("/perfil");
}

export type FechasFiestas = { inicio: string; fin: string };

/**
 * Las fechas de las fiestas de un año ("del 22 al 31 de agosto", o lo que
 * toque ese año). `null` significa que la directiva todavía no las ha
 * fijado: la limpieza no puede sortearse hasta entonces.
 */
export async function obtenerFechasFiestas(anio: number): Promise<FechasFiestas | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fiestas_fechas")
    .select("fecha_inicio, fecha_fin")
    .eq("anio", anio)
    .maybeSingle();

  if (!data) return null;
  return { inicio: data.fecha_inicio, fin: data.fecha_fin };
}

/**
 * Fija las fechas de las fiestas de un año. Así el año que viene no hace
 * falta tocar código para mover la limpieza a otras fechas: la directiva
 * elige el rango desde Gestión y ya.
 */
export async function actualizarFechasFiestas(anio: number, inicio: string, fin: string) {
  await exigirAdmin();

  if (!Number.isInteger(anio) || anio < 2010 || anio > 2100) {
    throw new Error("Año no válido.");
  }
  const patron = /^\d{4}-\d{2}-\d{2}$/;
  if (!patron.test(inicio) || !patron.test(fin)) {
    throw new Error("Pon las dos fechas.");
  }
  if (fin < inicio) {
    throw new Error("La fecha de fin no puede ser antes que la de inicio.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("fiestas_fechas")
    .upsert(
      { anio, fecha_inicio: inicio, fecha_fin: fin, actualizado_at: new Date().toISOString() },
      { onConflict: "anio" },
    );

  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  revalidatePath("/admin/limpieza");
  revalidatePath("/perfil");
}
