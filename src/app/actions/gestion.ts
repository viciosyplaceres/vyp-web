"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin, exigirMiembro } from "@/lib/auth";
import { avisarAdmins } from "@/lib/push";
import { esUrlDeCloudinary } from "@/lib/cloudinary-url";

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

export async function marcarDeuda(id: string, pagada: boolean) {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("deudas")
    .update({ pagada })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/deudas");
}

export async function borrarDeuda(id: string) {
  await exigirAdmin();
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

    const item = String(formData.get("item") ?? "").trim();
    const anio = Number(formData.get("anio"));
    const cantidad = Number(formData.get("cantidad") || 1);
    // Quién lo compra se elige ya al apuntarlo, sin tener que crear el
    // artículo primero y repartirlo después en otro paso.
    const asignados = String(formData.get("asignados") ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    if (!item) return { error: "Pon qué hay que comprar." };
    if (!Number.isInteger(anio) || anio < 2010 || anio > 2100) {
      return { error: "Año no válido." };
    }

    const supabase = await createClient();
    const { data: creado, error } = await supabase
      .from("lista_compra")
      .insert({
        item,
        anio,
        cantidad: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1,
        comprado: false,
      })
      .select("id")
      .single();

    if (error) return { error: error.message };

    if (creado && asignados.length) {
      const { error: errorAsignar } = await supabase
        .from("compra_miembros")
        .insert(asignados.map((perfilId) => ({ item_id: creado.id, perfil_id: perfilId })));
      if (errorAsignar) return { error: errorAsignar.message };
    }

    revalidatePath("/admin/compras");
    revalidatePath("/perfil");

    await avisarAdmins(
      {
        titulo: "Nuevo apunte en la compra",
        cuerpo: `Hay que comprar: ${item}.`,
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
