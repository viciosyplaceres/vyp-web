"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirMiembro, exigirAdmin } from "@/lib/auth";
import { esUrlDeCloudinary } from "@/lib/cloudinary-url";

/**
 * Guarda un diseño de camiseta que alguien acaba de subir a Cloudinary, para
 * que la peña lo vote. Cualquier miembro puede proponer.
 */
export async function registrarCamiseta(datos: {
  anio: number;
  titulo: string | null;
  url: string;
  storageId: string;
  bytes: number | null;
}) {
  const sesion = await exigirMiembro();

  // Misma cautela que con los tickets: la URL la manda el navegador.
  if (!esUrlDeCloudinary(datos.url)) {
    throw new Error("La imagen del diseño no es válida.");
  }

  const supabase = await createClient();

  const { error } = await supabase.from("camisetas").insert({
    anio: datos.anio,
    titulo: datos.titulo?.trim() || null,
    url: datos.url,
    storage_id: datos.storageId,
    bytes: datos.bytes,
    subido_por: sesion.userId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/camisetas");
}

/**
 * Pone tu voto en un diseño. Es **un voto por persona y año**: votar otra
 * camiseta mueve tu voto, y volver a votar la misma lo quita (como el "me
 * gusta" de cualquier sitio). Así "la más votada" siempre cuadra con cuánta
 * gente hay.
 */
export async function votarCamiseta(camisetaId: string, anio: number) {
  const sesion = await exigirMiembro();
  const supabase = await createClient();

  const { data: voto } = await supabase
    .from("camisetas_votos")
    .select("camiseta_id")
    .eq("perfil_id", sesion.userId)
    .eq("anio", anio)
    .maybeSingle();

  if (voto?.camiseta_id === camisetaId) {
    const { error } = await supabase
      .from("camisetas_votos")
      .delete()
      .eq("perfil_id", sesion.userId)
      .eq("anio", anio);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("camisetas_votos")
      .upsert(
        { perfil_id: sesion.userId, anio, camiseta_id: camisetaId },
        { onConflict: "perfil_id,anio" },
      );
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/camisetas");
}

/** Quita un diseño. La base de datos solo deja borrar el propio, o todos si eres admin. */
export async function borrarCamiseta(id: string) {
  await exigirMiembro();
  const supabase = await createClient();
  const { error } = await supabase.from("camisetas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/camisetas");
}

/**
 * Guarda cuántas camisetas quiere alguien y la talla de cada una.
 *
 * Las tallas viajan como un array con una posición por camiseta, así que la
 * cantidad es simplemente cuántas hay. Si el pedido baja a cero se borra la
 * fila en vez de dejar un array vacío: "no quiere" y "no lo ha dicho todavía"
 * se ven igual en la pantalla, y así no se acumulan filas muertas.
 */
export async function guardarPedidoCamiseta(
  perfilId: string,
  anio: number,
  tallas: string[],
) {
  const sesion = await exigirMiembro();

  // Cada uno lo suyo; la directiva puede rellenar el de cualquiera (siempre
  // hay quien lo dice por el grupo y no lo mete). La base de datos lo vuelve
  // a comprobar por su cuenta con RLS.
  if (perfilId !== sesion.userId && !sesion.esAdmin) {
    throw new Error("Solo puedes cambiar tu propio pedido.");
  }

  const limpias = tallas
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 20);

  const supabase = await createClient();

  if (limpias.length === 0) {
    const { error } = await supabase
      .from("pedidos_camiseta")
      .delete()
      .eq("perfil_id", perfilId)
      .eq("anio", anio);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("pedidos_camiseta").upsert(
      {
        perfil_id: perfilId,
        anio,
        tallas: limpias,
        actualizado_at: new Date().toISOString(),
      },
      { onConflict: "perfil_id,anio" },
    );
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/camisetas");
  revalidatePath("/perfil");
}

/** Marca o desmarca la cuota de un miembro. Solo la directiva: es quien cobra. */
export async function marcarPago(perfilId: string, anio: number, pagado: boolean) {
  await exigirAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("pagos").upsert(
    {
      perfil_id: perfilId,
      anio,
      pagado,
      actualizado_at: new Date().toISOString(),
    },
    { onConflict: "perfil_id,anio" },
  );

  if (error) throw new Error(error.message);
  revalidatePath("/admin/pagos");
  revalidatePath("/perfil");
}
