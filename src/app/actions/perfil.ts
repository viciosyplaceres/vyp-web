"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { exigirTemporadaAbierta } from "@/lib/temporada-servidor";

/**
 * Guarda nombre visible, nombre de usuario y avatar del propio perfil.
 *
 * No hace falta ser miembro aprobado: alguien recién registrado también debe
 * poder ponerse nombre y foto mientras espera. Lo que NUNCA se toca aquí es
 * `rol` ni `aprobado` — de eso ya se encarga un trigger en la base de datos,
 * que revierte cualquier intento que no venga de un admin.
 */
export async function guardarPerfil(
  _prev: { error?: string; ok?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean } | null> {
  const sesion = await getSesion();
  if (!sesion) return { error: "No has iniciado sesión." };
  try {
    exigirTemporadaAbierta();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Cambios cerrados." };
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  const usuarioBruto = String(formData.get("usuario") ?? "").trim();
  const avatarUrl = String(formData.get("avatarUrl") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();

  if (!nombre) return { error: "Pon tu nombre." };
  if (bio.length > 300) return { error: "La bio no puede pasar de 300 caracteres." };

  // Nombre de usuario en minúsculas y sin rarezas: se usa como identificador
  // visible y así no hay dos que se parezcan sospechosamente.
  const usuario = usuarioBruto
    ? usuarioBruto.toLowerCase().replace(/[^a-z0-9_.]/g, "")
    : null;

  if (usuario && (usuario.length < 3 || usuario.length > 20)) {
    return { error: "El nombre de usuario debe tener entre 3 y 20 caracteres." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("perfiles")
    .update({
      nombre,
      usuario,
      bio: bio || null,
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    })
    .eq("id", sesion.userId);

  if (error) {
    // 23505 = choque con el índice único de `usuario`
    if (error.code === "23505") {
      return { error: "Ese nombre de usuario ya está cogido." };
    }
    return { error: error.message };
  }

  revalidatePath("/perfil");
  revalidatePath("/", "layout");
  return { ok: true };
}
