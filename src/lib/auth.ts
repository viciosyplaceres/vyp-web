import { cache } from "react";
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre, usuario, avatar_url, bio, rol, aprobado, puede_asignar_roles")
    .eq("id", user.id)
    .single();

  const aprobado = perfil?.aprobado === true;

  return {
    userId: user.id,
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

/** Para marcar pagos: puede la directiva o el tesorero. */
export async function exigirPagos(): Promise<Sesion> {
  const sesion = await getSesion();
  if (!sesion?.esAdmin && !sesion?.esTesorero) {
    throw new Error("Solo la directiva o el tesorero pueden hacer esto.");
  }
  return sesion;
}
