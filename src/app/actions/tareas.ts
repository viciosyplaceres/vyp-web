"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin, exigirMiembro } from "@/lib/auth";
import { avisarUsuario, avisarMiembros } from "@/lib/push";

export type DatosTarea = {
  titulo: string;
  descripcion?: string | null;
  fecha?: string | null;
  asignados: string[];
  documentoClave?: string | null;
  documentoNombre?: string | null;
};

/** Crea una tarea y se la reparte a quien corresponda. Solo la directiva. */
export async function crearTarea(datos: DatosTarea) {
  const sesion = await exigirAdmin();
  const supabase = await createClient();

  const titulo = datos.titulo.trim();
  if (!titulo) throw new Error("La tarea necesita un título.");

  const { data: tarea, error } = await supabase
    .from("tareas")
    .insert({
      titulo,
      descripcion: datos.descripcion?.trim() || null,
      fecha: datos.fecha || null,
      documento_url: datos.documentoClave || null,
      documento_nombre: datos.documentoNombre || null,
      creado_por: sesion.userId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (datos.asignados.length) {
    const { error: errorAsig } = await supabase
      .from("tareas_miembros")
      .insert(datos.asignados.map((perfil_id) => ({ tarea_id: tarea.id, perfil_id })));
    if (errorAsig) throw new Error(errorAsig.message);
  }

  revalidatePath("/admin/tareas");
  revalidatePath("/perfil");

  // A cada encargado le llega su aviso; al resto no se le molesta.
  await Promise.all(
    datos.asignados.map((id) =>
      avisarUsuario(id, {
        titulo: "Te han asignado una tarea",
        cuerpo: titulo,
        url: "/perfil",
        tag: "tareas",
      }),
    ),
  );
}

export async function editarTarea(id: string, datos: DatosTarea) {
  await exigirAdmin();
  const supabase = await createClient();

  const titulo = datos.titulo.trim();
  if (!titulo) throw new Error("La tarea necesita un título.");

  const { error } = await supabase
    .from("tareas")
    .update({
      titulo,
      descripcion: datos.descripcion?.trim() || null,
      fecha: datos.fecha || null,
      documento_url: datos.documentoClave || null,
      documento_nombre: datos.documentoNombre || null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  // Se rehace el reparto entero: es más simple y seguro que ir comparando.
  await supabase.from("tareas_miembros").delete().eq("tarea_id", id);
  if (datos.asignados.length) {
    await supabase
      .from("tareas_miembros")
      .insert(datos.asignados.map((perfil_id) => ({ tarea_id: id, perfil_id })));
  }

  revalidatePath("/admin/tareas");
  revalidatePath("/perfil");
}

/**
 * Marca hecha o pendiente. Puede hacerlo la directiva o quien la tenga
 * asignada: el RLS y un trigger de base de datos garantizan que un asignado
 * solo pueda tocar el estado, nunca el título ni la fecha.
 */
export async function marcarTarea(id: string, hecha: boolean) {
  const sesion = await exigirMiembro();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tareas")
    .update({
      hecha,
      hecha_por: hecha ? sesion.userId : null,
      hecha_en: hecha ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select("titulo")
    .maybeSingle();

  if (error) throw new Error(error.message);

  revalidatePath("/admin/tareas");
  revalidatePath("/perfil");

  if (hecha && data?.titulo) {
    await avisarMiembros(
      {
        titulo: "Tarea completada",
        cuerpo: `${sesion.nombre ?? "Alguien"} ha terminado: ${data.titulo}`,
        url: "/admin/tareas",
        tag: "tareas",
      },
      sesion.userId,
    );
  }
}

export async function borrarTarea(id: string) {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("tareas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/tareas");
  revalidatePath("/perfil");
}

/** Reparte un artículo de la compra entre uno o varios miembros. */
export async function asignarCompra(itemId: string, perfiles: string[]) {
  await exigirAdmin();
  const supabase = await createClient();

  await supabase.from("compra_miembros").delete().eq("item_id", itemId);
  if (perfiles.length) {
    const { error } = await supabase
      .from("compra_miembros")
      .insert(perfiles.map((perfil_id) => ({ item_id: itemId, perfil_id })));
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/compras");
  revalidatePath("/perfil");

  await Promise.all(
    perfiles.map((id) =>
      avisarUsuario(id, {
        titulo: "Te toca comprar algo",
        cuerpo: "Mira tu lista en el perfil.",
        url: "/perfil",
        tag: "compras",
      }),
    ),
  );
}
