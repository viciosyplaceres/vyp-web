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
