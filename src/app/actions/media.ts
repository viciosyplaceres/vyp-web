"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirMiembro } from "@/lib/auth";
import { avisarMiembros } from "@/lib/push";

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

/**
 * Avisa UNA sola vez de que se ha subido tanda de fotos/vídeos.
 *
 * Va aparte de `registrarMedia` a propósito: subir 20 fotos de las fiestas es lo
 * normal, y mandar 20 notificaciones sería insoportable. El cliente llama a esto
 * al terminar todo el lote, con el total.
 */
export async function avisarSubidaGaleria(anio: number, cantidad: number) {
  const sesion = await exigirMiembro();
  if (cantidad < 1) return;

  const quien = sesion.nombre ?? "Alguien";
  const que =
    cantidad === 1
      ? "ha subido algo nuevo"
      : `ha subido ${cantidad} archivos nuevos`;

  await avisarMiembros(
    {
      titulo: "Nuevas fotos en la peña",
      cuerpo: `${quien} ${que} de las fiestas de ${anio}.`,
      url: `/galeria/${anio}`,
      tag: "galeria",
    },
    sesion.userId,
  );
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
