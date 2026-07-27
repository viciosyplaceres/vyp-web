"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function exigirAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado.");

  const { data: miPerfil } = await supabase
    .from("perfiles")
    .select("rol, aprobado")
    .eq("id", user.id)
    .single();

  if (miPerfil?.rol !== "admin" || !miPerfil.aprobado) {
    throw new Error("No autorizado.");
  }

  return supabase;
}

export async function aprobarMiembro(id: string) {
  // Chequeo explícito en el server action, ADEMÁS de la política RLS de "perfiles"
  // (que ya exige es_admin() para modificar el perfil de otro): defensa en profundidad.
  const supabase = await exigirAdmin();
  const { error } = await supabase
    .from("perfiles")
    .update({ aprobado: true })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/miembros");
}

export async function revocarMiembro(id: string) {
  const supabase = await exigirAdmin();
  const { error } = await supabase
    .from("perfiles")
    .update({ aprobado: false })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/miembros");
}
