"use server";

import { revalidatePath } from "next/cache";
import { v2 as cloudinary } from "cloudinary";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/auth";
import { r2, R2_BUCKET } from "@/lib/r2";
import { obtenerUsoCloudinary, obtenerUsoR2 } from "@/lib/almacenamiento";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function obtenerUso() {
  await exigirAdmin();
  const [cloudinaryUso, r2Uso] = await Promise.all([
    obtenerUsoCloudinary(),
    obtenerUsoR2(),
  ]);
  return { cloudinary: cloudinaryUso, r2: r2Uso };
}

/**
 * Borra una foto/vídeo de verdad: primero el archivo en Cloudinary, luego la
 * fila. Borrar solo la fila (lo que hacía `borrarMedia` hasta ahora) no libera
 * ni un byte del almacenamiento gratuito — y liberar espacio es justo el
 * propósito de este panel.
 */
export async function borrarMediaAdmin(
  id: string,
  anio: number,
  storageId: string,
  tipo: "foto" | "video",
) {
  await exigirAdmin();

  await cloudinary.uploader
    .destroy(storageId, { resource_type: tipo === "video" ? "video" : "image" })
    .catch(() => undefined); // si ya no existe en Cloudinary, se sigue borrando la fila

  const supabase = await createClient();
  const { error } = await supabase.from("media").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/galeria");
  revalidatePath(`/galeria/${anio}`);
  revalidatePath("/admin/almacenamiento");
}

/**
 * Borrado en lote desde el panel de almacenamiento: destruye todos los
 * archivos en Cloudinary (los fallos puntuales no detienen el lote) y luego
 * borra todas las filas de una vez. Devuelve cuántos elementos se borraron.
 */
export async function borrarMediaLote(
  elementos: { id: string; anio: number; storageId: string; tipo: "foto" | "video" }[],
) {
  await exigirAdmin();
  if (elementos.length === 0) return { borrados: 0 };

  await Promise.allSettled(
    elementos.map((e) =>
      cloudinary.uploader.destroy(e.storageId, {
        resource_type: e.tipo === "video" ? "video" : "image",
      }),
    ),
  );

  const supabase = await createClient();
  const { error } = await supabase
    .from("media")
    .delete()
    .in("id", elementos.map((e) => e.id));
  if (error) throw new Error(error.message);

  revalidatePath("/galeria");
  for (const anio of new Set(elementos.map((e) => e.anio))) {
    revalidatePath(`/galeria/${anio}`);
  }
  revalidatePath("/admin/almacenamiento");
  return { borrados: elementos.length };
}

/** Igual que arriba, pero para música guardada en R2. */
export async function borrarPistaAdmin(
  id: string,
  origen: "r2" | "mixcloud" | "soundcloud",
  clave: string,
) {
  await exigirAdmin();

  if (origen === "r2") {
    await r2
      .send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: clave }))
      .catch(() => undefined);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("pistas").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/musica");
  revalidatePath("/admin/almacenamiento");
}
