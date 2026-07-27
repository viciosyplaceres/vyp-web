"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirMiembro } from "@/lib/auth";

export type DatosMedia = {
  tipo: "foto" | "video";
  anio: number;
  storageId: string;
  url: string;
  thumbUrl?: string | null;
  ancho?: number | null;
  alto?: number | null;
  duracionS?: number | null;
  descripcion?: string | null;
};

/** Registra en la base de datos algo que ya se subió a Cloudinary. */
export async function registrarMedia(datos: DatosMedia) {
  const sesion = await exigirMiembro();
  const supabase = await createClient();

  const { error } = await supabase.from("media").insert({
    tipo: datos.tipo,
    anio: datos.anio,
    storage_id: datos.storageId,
    url: datos.url,
    thumb_url: datos.thumbUrl ?? null,
    ancho: datos.ancho ?? null,
    alto: datos.alto ?? null,
    duracion_s: datos.duracionS ?? null,
    descripcion: datos.descripcion?.trim() || null,
    subido_por: sesion.userId,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/galeria");
  revalidatePath(`/galeria/${datos.anio}`);
}

export async function borrarMedia(id: string, anio: number) {
  await exigirMiembro();
  const supabase = await createClient();

  // El RLS solo deja borrar lo propio (o cualquier cosa si eres admin).
  const { error } = await supabase.from("media").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/galeria");
  revalidatePath(`/galeria/${anio}`);
}
