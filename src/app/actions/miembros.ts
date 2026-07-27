"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function aprobarMiembro(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("perfiles")
    .update({ aprobado: true })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/miembros");
}

export async function revocarMiembro(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("perfiles")
    .update({ aprobado: false })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/miembros");
}
