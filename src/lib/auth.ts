import { createClient } from "@/lib/supabase/server";

export type Sesion = {
  userId: string;
  nombre: string | null;
  esMiembro: boolean;
  esAdmin: boolean;
};

/**
 * Devuelve la sesión con el rol ya resuelto, o null si no hay usuario.
 * Es la fuente única de verdad para decidir qué puede hacer alguien en la
 * interfaz. La base de datos vuelve a comprobarlo por su cuenta con RLS.
 */
export async function getSesion(): Promise<Sesion | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre, rol, aprobado")
    .eq("id", user.id)
    .single();

  return {
    userId: user.id,
    nombre: perfil?.nombre ?? null,
    esMiembro: perfil?.aprobado === true,
    esAdmin: perfil?.rol === "admin" && perfil?.aprobado === true,
  };
}

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
