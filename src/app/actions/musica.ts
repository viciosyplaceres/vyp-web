"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirMiembro } from "@/lib/auth";
import { analizarEnlaceMusica } from "@/lib/embeds";
import { avisarMiembros } from "@/lib/push";
import { esClaveMusica } from "@/lib/r2-claves";
import { exigirTemporadaAbierta } from "@/lib/temporada-servidor";

/** Registra una pista propia ya subida a R2. */
export async function registrarPistaR2(datos: {
  titulo: string;
  artista?: string | null;
  tipo: "sesion" | "cancion";
  anio?: number | null;
  clave: string;
  duracionS?: number | null;
  bytes?: number | null;
}) {
  const sesion = await exigirMiembro();
  exigirTemporadaAbierta();
  const supabase = await createClient();

  if (!datos.titulo?.trim()) throw new Error("Hace falta un título.");
  if (!esClaveMusica(datos.clave)) throw new Error("Clave de audio no válida.");

  const { error } = await supabase.from("pistas").insert({
    titulo: datos.titulo.trim(),
    artista: datos.artista?.trim() || null,
    tipo: datos.tipo,
    anio: datos.anio ?? null,
    origen: "r2",
    url: datos.clave,
    embed_url: null,
    duracion_s: datos.duracionS ?? null,
    bytes: datos.bytes ?? null,
    subido_por: sesion.userId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/musica");

  await avisarMiembros(
    {
      titulo: datos.tipo === "sesion" ? "Nueva sesión" : "Nueva canción",
      cuerpo: `${sesion.nombre ?? "Alguien"} ha subido «${datos.titulo.trim()}».`,
      url: "/musica",
      tag: "musica",
    },
    sesion.userId,
  );
}

/** Registra una sesión que ya está publicada en Mixcloud o SoundCloud. */
export async function registrarPistaEnlace(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  try {
    const sesion = await exigirMiembro();
    exigirTemporadaAbierta();

    const titulo = String(formData.get("titulo") ?? "").trim();
    const artista = String(formData.get("artista") ?? "").trim();
    const enlace = String(formData.get("enlace") ?? "").trim();
    const anioTexto = String(formData.get("anio") ?? "").trim();

    if (!titulo) return { error: "Pon un título." };

    const analizado = await analizarEnlaceMusica(enlace);
    if (!analizado) {
      return {
        error: "El enlace debe ser de Mixcloud o de SoundCloud.",
      };
    }

    const anio = anioTexto ? Number(anioTexto) : null;
    if (anio !== null && (!Number.isInteger(anio) || anio < 2010 || anio > 2100)) {
      return { error: "Año no válido." };
    }

    const supabase = await createClient();
    const { error } = await supabase.from("pistas").insert({
      titulo,
      artista: artista || null,
      tipo: "sesion",
      anio,
      origen: analizado.origen,
      url: analizado.url,
      embed_url: analizado.embedUrl,
      subido_por: sesion.userId,
    });

    if (error) return { error: error.message };

    revalidatePath("/musica");

    await avisarMiembros(
      {
        titulo: "Nueva sesión",
        cuerpo: `${sesion.nombre ?? "Alguien"} ha añadido «${titulo}».`,
        url: "/musica",
        tag: "musica",
      },
      sesion.userId,
    );

    return { error: undefined };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function borrarPista(id: string) {
  await exigirMiembro();
  const supabase = await createClient();
  const { error } = await supabase.from("pistas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/musica");
  revalidatePath("/perfil");
  revalidatePath("/perfil/musica");
  revalidatePath("/");
}
