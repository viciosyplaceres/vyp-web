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
  bytes?: number | null;
};

/**
 * Registra en la base de datos algo que ya se subió a Cloudinary.
 *
 * A propósito NO llama a `revalidatePath` aquí. Cuando se suben varias fotos
 * seguidas, el cliente llama a esta función una vez por fichero dentro de un
 * bucle; si cada llamada revalidara la ruta, Next.js trata esa revalidación
 * como el arranque de una navegación y cancela las peticiones de las
 * siguientes fotos que aún están en camino — es lo que hacía que, al elegir
 * 10 fotos, solo la primera llegara a guardarse. La revalidación se hace una
 * sola vez al final del lote, en `finalizarSubidaGaleria`.
 */
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
    bytes: datos.bytes ?? null,
    subido_por: sesion.userId,
  });

  if (error) throw new Error(error.message);
}

/**
 * Se llama UNA sola vez al terminar toda la tanda: revalida la página de la
 * galería (aquí sí, ya no hay más llamadas en camino que se puedan cancelar)
 * y avisa a los demás miembros. Mandar un aviso por cada foto sería
 * insoportable con una tanda de 20.
 */
export async function finalizarSubidaGaleria(anio: number, cantidad: number) {
  const sesion = await exigirMiembro();

  revalidatePath("/galeria");
  revalidatePath(`/galeria/${anio}`);

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
