"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin, exigirMiembro, exigirDirectivaOTesorero } from "@/lib/auth";
import { avisarAdmins } from "@/lib/push";
import { esUrlDeCloudinary } from "@/lib/cloudinary-url";
import { validarArticulosCompra, validarAsignadosCompra } from "@/lib/compra";
import { esClaveDocumento } from "@/lib/r2-claves";

// `participantes` (talla + pago + importe en una sola ficha) se retiró: se
// partió en `Camisetas` y `Pagos`, que es como se usa de verdad. Sus acciones
// vivían aquí y ya no existen; lo que las sustituye está en `actions/camisetas.ts`.

// ---------- Deudas (quién le debe dinero a quién) ----------

export type MiembroODeuda = { id: string; nombre: string | null };

export async function crearDeuda(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  try {
    const sesion = await exigirAdmin();

    // "" en el desplegable significa "VYP" (la peña), que se guarda como NULL.
    const deudorId = String(formData.get("deudor") ?? "") || null;
    const acreedorId = String(formData.get("acreedor") ?? "") || null;
    const cantidad = Number(formData.get("cantidad"));
    const descripcion = String(formData.get("descripcion") ?? "").trim();
    // La foto del ticket ya está subida a Cloudinary cuando llega aquí: el
    // formulario solo trae su URL y el identificador para poder borrarla.
    const ticketUrl = String(formData.get("ticketUrl") ?? "").trim();
    const ticketStorageId = String(formData.get("ticketStorageId") ?? "").trim();

    if (deudorId === null && acreedorId === null) {
      return { error: "Deudor y acreedor no pueden ser los dos VYP." };
    }
    if (deudorId && deudorId === acreedorId) {
      return { error: "Deudor y acreedor no pueden ser el mismo." };
    }
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return { error: "Pon una cantidad válida." };
    }
    // La URL del ticket viene del navegador, así que se comprueba que de
    // verdad apunte a nuestro Cloudinary antes de guardarla: luego se pinta
    // como enlace y las deudas las ve toda la peña.
    if (ticketUrl && !esUrlDeCloudinary(ticketUrl)) {
      return { error: "La foto del ticket no es válida." };
    }

    const supabase = await createClient();
    const { error } = await supabase.from("deudas").insert({
      deudor_id: deudorId,
      acreedor_id: acreedorId,
      cantidad,
      descripcion: descripcion || null,
      ticket_url: ticketUrl || null,
      ticket_storage_id: ticketStorageId || null,
      creado_por: sesion.userId,
    });

    if (error) return { error: error.message };
    revalidatePath("/admin/deudas");

    return { error: undefined };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

/**
 * Marca o desmarca una deuda como saldada. Puede la directiva, el tesorero,
 * o el propio acreedor (a quien se le debe) si es un miembro concreto — si
 * la acreedora es la peña entera, no hay "el propio acreedor" y solo quedan
 * directiva y tesorero. La política RLS de `deudas` exige exactamente esto
 * por su cuenta (y un trigger le impide tocar nada más que `pagada`), pero
 * se comprueba aquí también para dar un error claro en vez de un fallo
 * silencioso de PostgREST.
 */
export async function marcarDeuda(id: string, pagada: boolean) {
  const sesion = await exigirMiembro();
  const supabase = await createClient();

  if (!sesion.esAdmin && !sesion.esTesorero) {
    const { data: deuda } = await supabase
      .from("deudas")
      .select("acreedor_id")
      .eq("id", id)
      .maybeSingle();

    if (deuda?.acreedor_id !== sesion.userId) {
      throw new Error(
        "Solo quien tiene la deuda a su favor, la directiva o el tesorero pueden marcarla.",
      );
    }
  }

  const { error } = await supabase
    .from("deudas")
    .update({ pagada })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/deudas");
}

/** Borrar una deuda es solo de la directiva o el tesorero, nunca del acreedor. */
export async function borrarDeuda(id: string) {
  await exigirDirectivaOTesorero();
  const supabase = await createClient();
  const { error } = await supabase.from("deudas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/deudas");
}

// ---------- Lista de la compra ----------

export async function crearItemCompra(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  try {
    const sesion = await exigirAdmin();

    const anio = Number(formData.get("anio"));
    const resultadoArticulos = validarArticulosCompra(
      String(formData.get("items") ?? "[]"),
    );
    if (!resultadoArticulos.datos) return { error: resultadoArticulos.error };
    const entradas = resultadoArticulos.datos;

    // Quién lo compra se elige ya al apuntarlo, sin tener que crear el
    // artículo primero y repartirlo después en otro paso.
    const resultadoAsignados = validarAsignadosCompra(
      String(formData.get("asignados") ?? ""),
    );
    if (!resultadoAsignados.datos) return { error: resultadoAsignados.error };
    const asignados = resultadoAsignados.datos;

    // El documento (si se adjuntó) ya está subido a R2 cuando llega aquí:
    // el formulario solo trae su clave y su nombre, igual que en tareas.
    const documentoClave = String(formData.get("documentoClave") ?? "").trim();
    const documentoNombre = String(formData.get("documentoNombre") ?? "").trim();

    if (!Number.isInteger(anio) || anio < 2010 || anio > 2100) {
      return { error: "Año no válido." };
    }
    if (Boolean(documentoClave) !== Boolean(documentoNombre)) {
      return { error: "El documento adjunto está incompleto." };
    }
    if (documentoClave && !esClaveDocumento(documentoClave)) {
      return { error: "La clave del documento no es válida." };
    }
    if (documentoNombre.length > 255) {
      return { error: "El nombre del documento es demasiado largo." };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("crear_items_compra", {
      p_anio: anio,
      p_items: entradas,
      p_asignados: asignados,
      p_documento_url: documentoClave || null,
      p_documento_nombre: documentoNombre || null,
    });

    if (error) return { error: error.message };

    revalidatePath("/admin/compras");
    revalidatePath("/perfil");

    await avisarAdmins(
      {
        titulo: entradas.length === 1 ? "Nuevo apunte en la compra" : "Nuevos apuntes en la compra",
        cuerpo:
          entradas.length === 1
            ? `Hay que comprar: ${entradas[0].item}.`
            : `Se han añadido ${entradas.length} artículos a la lista.`,
        url: "/admin/compras",
        tag: "compras",
      },
      sesion.userId,
    );

    return { error: undefined };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

/**
 * Marca un artículo como comprado (o lo desmarca).
 *
 * Pide ser miembro, NO admin: quien lo tiene asignado tiene que poder tacharlo
 * desde su propio perfil. La política RLS de `lista_compra` ya dice
 * exactamente eso (`es_admin() or compra_asignada(id)`), así que es la base de
 * datos la que decide de verdad. Antes exigía admin y no cuadraba con su
 * gemela `marcarTarea`: un miembro podía dar por hecha su tarea pero le
 * saltaba "Solo la directiva puede hacer esto" al tachar su compra.
 */
export async function alternarComprado(id: string, comprado: boolean) {
  const sesion = await exigirMiembro();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lista_compra")
    .update({ comprado })
    .eq("id", id)
    .select("item")
    .maybeSingle();
  if (error) throw new Error(error.message);
  revalidatePath("/admin/compras");

  if (data?.item && comprado) {
    await avisarAdmins(
      {
        titulo: "Comprado",
        cuerpo: `Ya está comprado: ${data.item}.`,
        url: "/admin/compras",
        tag: "compras",
      },
      sesion.userId,
    );
  }
}

export async function borrarItemCompra(id: string) {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("lista_compra").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/compras");
}

/**
 * Adjunta, sustituye o quita el documento de un artículo ya creado. Pasa
 * `null` en ambos campos para quitarlo. Solo la directiva: el trigger
 * `compra_solo_marcar` ya bloquearía el intento igualmente.
 */
export async function adjuntarDocumentoCompra(
  id: string,
  documentoClave: string | null,
  documentoNombre: string | null,
) {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("lista_compra")
    .update({ documento_url: documentoClave, documento_nombre: documentoNombre })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/compras");
}
