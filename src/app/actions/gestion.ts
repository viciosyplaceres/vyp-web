"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/auth";
import { avisarAdmins } from "@/lib/push";

// ---------- Participantes (quién ha pagado, tallas, por año) ----------
//
// Ya no se "crean" participantes a mano: la lista sale sola de los miembros
// aprobados. Cada fila de `participantes` es la ficha de un miembro en un año
// concreto (talla + pago), y se guarda con upsert sobre (perfil_id, anio).

export type DatosParticipante = {
  talla: string | null;
  pagado: boolean;
  importe: number | null;
};

export async function guardarParticipante(
  perfilId: string,
  anio: number,
  datos: DatosParticipante,
  nombreMiembro: string,
) {
  const sesion = await exigirAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("participantes").upsert(
    {
      perfil_id: perfilId,
      anio,
      talla_camiseta: datos.talla?.trim() || null,
      pagado: datos.pagado,
      importe: datos.importe,
    },
    { onConflict: "perfil_id,anio" },
  );

  if (error) throw new Error(error.message);
  revalidatePath("/admin/participantes");

  if (datos.pagado) {
    await avisarAdmins(
      {
        titulo: "Pago recibido",
        cuerpo: `${nombreMiembro} figura como pagado en ${anio}.`,
        url: "/admin/participantes",
        tag: "gestion",
      },
      sesion.userId,
    );
  }
}

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

    if (deudorId === null && acreedorId === null) {
      return { error: "Deudor y acreedor no pueden ser los dos VYP." };
    }
    if (deudorId && deudorId === acreedorId) {
      return { error: "Deudor y acreedor no pueden ser el mismo." };
    }
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return { error: "Pon una cantidad válida." };
    }

    const supabase = await createClient();
    const { error } = await supabase.from("deudas").insert({
      deudor_id: deudorId,
      acreedor_id: acreedorId,
      cantidad,
      descripcion: descripcion || null,
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
