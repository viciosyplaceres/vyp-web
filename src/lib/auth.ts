import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type Sesion = {
  userId: string;
  nombre: string | null;
  usuario: string | null;
  avatarUrl: string | null;
  bio: string | null;
  esMiembro: boolean;
  esAdmin: boolean;
  /** Tesorero: puede marcar pagos, como la directiva, pero no aprobar ni tocar el almacenamiento. */
  esTesorero: boolean;
  /** Solo quien tiene esto puede cambiar el rol de otra cuenta (dar o quitar directiva/tesorero). */
  puedeAsignarRoles: boolean;
};

/** Identidad validada por el proxy para esta petición, nunca por el navegador. */
export async function getUserIdValidado(): Promise<string | null> {
  return (await headers()).get("x-vyp-user-id");
}

/**
 * Devuelve la sesión con el rol ya resuelto, o null si no hay usuario.
 * Es la fuente única de verdad para decidir qué puede hacer alguien en la
 * interfaz. La base de datos vuelve a comprobarlo por su cuenta con RLS.
 *
 * Va envuelta en `cache()` de React, que memoriza el resultado **dentro de una
 * misma petición** (nunca entre peticiones ni entre usuarios distintos: cada
 * render arranca con la memoria vacía). Sin esto, pintar la portada llamaba
 * aquí cinco veces: el layout, su contador de no leídos, el header, su
 * contador de pendientes y la propia página.
 *
 * Medido en local con la sesión de un miembro real, sumando lo que tardaba
 * cada llamada: 5 llamadas (152+150+10+6+2 = 320 ms) → 1 llamada (138 ms).
 * Las tres últimas ya salían baratas porque supabase-js reaprovecha la
 * conexión, así que el ahorro real ronda los 180 ms de trabajo por render y
 * cinco veces menos peticiones contra el proyecto de Supabase —que está en
 * plan gratuito y sí tiene cupo—. En el TTFB medido no se aprecia una mejora
 * clara: lo dominan otras cosas.
 */
export const getSesion = cache(async (): Promise<Sesion | null> => {
  // `proxy.ts` elimina cualquier valor enviado por el navegador y solo añade
  // esta cabecera tras validar el JWT con getClaims(). Así evitamos una
  // segunda llamada a Auth sin confiar en el contenido local de la cookie.
  const userId = await getUserIdValidado();
  if (!userId) return null;

  const supabase = await createClient();
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre, usuario, avatar_url, bio, rol, aprobado, puede_asignar_roles")
    .eq("id", userId)
    .maybeSingle();

  // La cabecera solo sirve como pista para la búsqueda. RLS valida de nuevo
  // el JWT al consultar Postgres; sin un perfil visible no existe sesión.
  if (!perfil) return null;

  const aprobado = perfil?.aprobado === true;

  return {
    userId,
    nombre: perfil?.nombre ?? null,
    usuario: perfil?.usuario ?? null,
    avatarUrl: perfil?.avatar_url ?? null,
    bio: perfil?.bio ?? null,
    esMiembro: aprobado,
    esAdmin: perfil?.rol === "admin" && aprobado,
    esTesorero: perfil?.rol === "tesorero" && aprobado,
    puedeAsignarRoles: perfil?.puede_asignar_roles === true && aprobado,
  };
});

/** Lanza si quien llama no es miembro aprobado. Para usar en server actions. */
export async function exigirMiembro(): Promise<Sesion> {
  const sesion = await getSesion();
  if (!sesion?.esMiembro) {
    throw new Error("Solo los miembros de la peña pueden hacer esto.");
  }
  return sesion;
}

/** Lanza si quien llama no es admin aprobado. Para usar en server actions. */
export async function exigirAdmin(): Promise<Sesion> {
  const sesion = await getSesion();
  if (!sesion?.esAdmin) {
    throw new Error("Solo la directiva puede hacer esto.");
  }
  return sesion;
}

/**
 * Para lo que puede hacer la directiva o el tesorero por igual: marcar
 * pagos, borrar deudas... Nada relacionado con altas ni almacenamiento, que
 * siguen siendo solo de `exigirAdmin`.
 */
export async function exigirDirectivaOTesorero(): Promise<Sesion> {
  const sesion = await getSesion();
  if (!sesion?.esAdmin && !sesion?.esTesorero) {
    throw new Error("Solo la directiva o el tesorero pueden hacer esto.");
  }
  return sesion;
}
