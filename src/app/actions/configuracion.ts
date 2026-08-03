"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/auth";
import { exigirTemporadaAbierta } from "@/lib/temporada-servidor";

export type UbicacionPublica = {
  nombre: string;
  direccion: string;
  mapsUrl: string;
  /** null = la directiva aún no ha configurado un pin GPS real. */
  latitud: number | null;
  longitud: number | null;
};

// Solo se usa si la fila «configuracion» no existiera en absoluto (no debería
// pasar: las migraciones la crean siempre). Nombre genérico de la localidad,
// sin dirección ni pin: cada peña pone su sede real desde Gestión.
const UBICACION_POR_DEFECTO: UbicacionPublica = {
  nombre: "Fuente Álamo · Murcia",
  direccion: "",
  mapsUrl: "",
  latitud: null,
  longitud: null,
};

/**
 * El año en el que está trabajando la peña ahora mismo. Lo fija la directiva
 * una vez (normalmente al empezar a preparar las fiestas siguientes) y a
 * partir de ahí Tareas, Participantes y la Compra lo usan por defecto, sin
 * tener que volver a elegirlo cada vez.
 */
export async function obtenerAnioActivo(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("configuracion")
    .select("anio_activo")
    .eq("id", true)
    .single();

  return data?.anio_activo ?? new Date().getFullYear();
}

export async function actualizarAnioActivo(anio: number) {
  await exigirAdmin();
  exigirTemporadaAbierta();

  if (!Number.isInteger(anio) || anio < 2010 || anio > 2100) {
    throw new Error("Año no válido.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("configuracion")
    .update({ anio_activo: anio })
    .eq("id", true);

  if (error) throw new Error(error.message);

  // Todo lo que depende del año activo se refresca de golpe.
  revalidatePath("/admin");
  revalidatePath("/admin/tareas");
  revalidatePath("/admin/camisetas");
  revalidatePath("/admin/pagos");
  revalidatePath("/admin/compras");
  revalidatePath("/perfil");
}

/** La ubicación que se muestra públicamente en la portada. */
export async function obtenerUbicacion(): Promise<UbicacionPublica> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("configuracion")
    .select(
      "ubicacion_nombre, ubicacion_direccion, ubicacion_maps_url, ubicacion_latitud, ubicacion_longitud",
    )
    .eq("id", true)
    .maybeSingle();

  if (!data) return UBICACION_POR_DEFECTO;
  return {
    nombre: data.ubicacion_nombre,
    direccion: data.ubicacion_direccion,
    mapsUrl: data.ubicacion_maps_url,
    latitud: data.ubicacion_latitud === null ? null : Number(data.ubicacion_latitud),
    longitud: data.ubicacion_longitud === null ? null : Number(data.ubicacion_longitud),
  };
}

/** Cambia la sede sin tocar código; solo la directiva puede actualizarla. */
export async function actualizarUbicacion(ubicacion: UbicacionPublica) {
  await exigirAdmin();
  exigirTemporadaAbierta();

  const nombre = ubicacion.nombre.trim();
  const direccion = ubicacion.direccion.trim();
  if (!nombre || nombre.length > 120) throw new Error("Pon un nombre breve para la ubicación.");
  if (!direccion || direccion.length > 300) throw new Error("Pon la dirección de la peña.");
  if (ubicacion.latitud === null || !Number.isFinite(ubicacion.latitud) || ubicacion.latitud < -90 || ubicacion.latitud > 90) {
    throw new Error("La latitud debe estar entre -90 y 90.");
  }
  if (ubicacion.longitud === null || !Number.isFinite(ubicacion.longitud) || ubicacion.longitud < -180 || ubicacion.longitud > 180) {
    throw new Error("La longitud debe estar entre -180 y 180.");
  }

  let mapsUrl: URL;
  try {
    mapsUrl = new URL(ubicacion.mapsUrl.trim());
  } catch {
    throw new Error("La URL de Google Maps no es válida.");
  }
  const host = mapsUrl.hostname.toLowerCase();
  const esGoogleMaps =
    mapsUrl.protocol === "https:" &&
    (host === "goo.gl" ||
      host.endsWith(".goo.gl") ||
      host === "google.com" ||
      host.endsWith(".google.com") ||
      host.startsWith("google.") ||
      host.startsWith("www.google."));
  if (!esGoogleMaps) throw new Error("Usa un enlace HTTPS de Google Maps.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("configuracion")
    .update({
      ubicacion_nombre: nombre,
      ubicacion_direccion: direccion,
      ubicacion_maps_url: mapsUrl.toString(),
      ubicacion_latitud: ubicacion.latitud,
      ubicacion_longitud: ubicacion.longitud,
      ubicacion_actualizada_at: new Date().toISOString(),
    })
    .eq("id", true);

  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/admin");
}

export type FechasFiestas = {
  inicio: string;
  fin: string;
  plazasLimpieza: number;
  plazasDesmontaje: number;
};

/**
 * Las fechas de las fiestas de un año ("del 22 al 31 de agosto", o lo que
 * toque ese año). `null` significa que la directiva todavía no las ha
 * fijado: la limpieza no puede sortearse hasta entonces.
 */
export async function obtenerFechasFiestas(anio: number): Promise<FechasFiestas | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fiestas_fechas")
    .select("fecha_inicio, fecha_fin, plazas_limpieza, plazas_desmontaje")
    .eq("anio", anio)
    .maybeSingle();

  if (!data) return null;
  return {
    inicio: data.fecha_inicio,
    fin: data.fecha_fin,
    plazasLimpieza: data.plazas_limpieza,
    plazasDesmontaje: data.plazas_desmontaje,
  };
}

/**
 * Fija las fechas de las fiestas de un año. Así el año que viene no hace
 * falta tocar código para mover la limpieza a otras fechas: la directiva
 * elige el rango desde Gestión y ya.
 */
export async function actualizarFechasFiestas(
  anio: number,
  inicio: string,
  fin: string,
  plazasLimpieza: number,
  plazasDesmontaje: number,
) {
  await exigirAdmin();
  exigirTemporadaAbierta();

  if (!Number.isInteger(anio) || anio < 2010 || anio > 2100) {
    throw new Error("Año no válido.");
  }
  const patron = /^\d{4}-\d{2}-\d{2}$/;
  if (!patron.test(inicio) || !patron.test(fin)) {
    throw new Error("Pon las dos fechas.");
  }
  if (fin < inicio) {
    throw new Error("La fecha de fin no puede ser antes que la de inicio.");
  }
  if (!Number.isInteger(plazasLimpieza) || plazasLimpieza < 1 || plazasLimpieza > 20) {
    throw new Error("Las plazas de limpieza deben estar entre 1 y 20.");
  }
  if (!Number.isInteger(plazasDesmontaje) || plazasDesmontaje < 1 || plazasDesmontaje > 20) {
    throw new Error("Las plazas de desmontaje deben estar entre 1 y 20.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("fiestas_fechas")
    .upsert(
      {
        anio,
        fecha_inicio: inicio,
        fecha_fin: fin,
        plazas_limpieza: plazasLimpieza,
        plazas_desmontaje: plazasDesmontaje,
        actualizado_at: new Date().toISOString(),
      },
      { onConflict: "anio" },
    );

  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  revalidatePath("/admin/limpieza");
  revalidatePath("/perfil");
}
