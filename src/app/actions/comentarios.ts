"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirMiembro } from "@/lib/auth";

export async function comentarMedia(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  try {
    const sesion = await exigirMiembro();

    const mediaId = String(formData.get("mediaId") ?? "");
    const anio = String(formData.get("anio") ?? "");
    const texto = String(formData.get("texto") ?? "").trim();

    if (!texto) return { error: "Escribe algo antes de enviar." };
    if (texto.length > 2000) return { error: "El comentario es muy largo." };

    const supabase = await createClient();
    const { error } = await supabase.from("comentarios").insert({
      media_id: mediaId,
      autor_id: sesion.userId,
      texto,
    });

    if (error) return { error: error.message };

    revalidatePath(`/galeria/${anio}/${mediaId}`);
    return { error: undefined };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function borrarComentario(
  id: string,
  mediaId: string,
  anio: number,
) {
  await exigirMiembro();
  const supabase = await createClient();
  const { error } = await supabase.from("comentarios").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/galeria/${anio}/${mediaId}`);
}
