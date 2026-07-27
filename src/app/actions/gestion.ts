"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/auth";
import { avisarAdmins } from "@/lib/push";

// ---------- Participantes (quién ha pagado, tallas) ----------

export async function crearParticipante(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  try {
    const sesion = await exigirAdmin();

    const nombre = String(formData.get("nombre") ?? "").trim();
    const anio = Number(formData.get("anio"));
    const talla = String(formData.get("talla") ?? "").trim();
    const importeTexto = String(formData.get("importe") ?? "").trim();

    if (!nombre) return { error: "Pon un nombre." };
    if (!Number.isInteger(anio) || anio < 2010 || anio > 2100) {
      return { error: "Año no válido." };
    }

    const supabase = await createClient();
    const { error } = await supabase.from("participantes").insert({
      nombre,
      anio,
      talla_camiseta: talla || null,
      importe: importeTexto ? Number(importeTexto) : null,
      pagado: false,
    });

    if (error) return { error: error.message };
    revalidatePath("/admin");

    // Solo a la directiva: los pagos y las tallas no son asunto público.
    await avisarAdmins(
      {
        titulo: "Nuevo participante",
        cuerpo: `${sesion.nombre ?? "La directiva"} ha apuntado a ${nombre} en ${anio}.`,
        url: "/admin",
        tag: "gestion",
      },
      sesion.userId,
    );

    return { error: undefined };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function alternarPago(id: string, pagado: boolean) {
  const sesion = await exigirAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("participantes")
    .update({ pagado })
    .eq("id", id)
    .select("nombre")
    .maybeSingle();
  if (error) throw new Error(error.message);
  revalidatePath("/admin");

  if (data?.nombre) {
    await avisarAdmins(
      {
        titulo: pagado ? "Pago recibido" : "Pago desmarcado",
        cuerpo: `${data.nombre} figura ahora como ${pagado ? "pagado" : "pendiente"}.`,
        url: "/admin",
        tag: "gestion",
      },
      sesion.userId,
    );
  }
}

export async function borrarParticipante(id: string) {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("participantes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
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

    if (!item) return { error: "Pon qué hay que comprar." };
    if (!Number.isInteger(anio) || anio < 2010 || anio > 2100) {
      return { error: "Año no válido." };
    }

    const supabase = await createClient();
    const { error } = await supabase.from("lista_compra").insert({
      item,
      anio,
      cantidad: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1,
      comprado: false,
    });

    if (error) return { error: error.message };
    revalidatePath("/admin/compras");

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

export async function alternarComprado(id: string, comprado: boolean) {
  const sesion = await exigirAdmin();
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
