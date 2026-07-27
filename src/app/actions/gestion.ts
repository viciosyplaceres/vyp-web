"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/auth";

// ---------- Participantes (quién ha pagado, tallas) ----------

export async function crearParticipante(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  try {
    await exigirAdmin();

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
    return { error: undefined };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function alternarPago(id: string, pagado: boolean) {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("participantes")
    .update({ pagado })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
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
    await exigirAdmin();

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
    return { error: undefined };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function alternarComprado(id: string, comprado: boolean) {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("lista_compra")
    .update({ comprado })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/compras");
}

export async function borrarItemCompra(id: string) {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("lista_compra").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/compras");
}
