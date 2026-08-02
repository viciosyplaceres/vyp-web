"use server";

import { redirect } from "next/navigation";
import { exigirMiembro } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Traspasa la sesión de un miembro aprobado a Fiestas Fuente Álamo sin
 * pedirle otra vez la contraseña. Genera un enlace mágico de Supabase Auth de
 * un solo uso (ambas apps comparten el mismo proyecto de Auth) y redirige a
 * FFA, que lo canjea por su propia sesión de navegador en /entrar-desde-pena.
 *
 * El email nunca lo manda el navegador: se obtiene de la sesión ya validada
 * por el proxy (exigirMiembro + getUser), así que nadie puede pedir un enlace
 * para una cuenta que no es la suya.
 */
export async function irAComunidad() {
  await exigirMiembro();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    throw new Error("No se pudo identificar la cuenta.");
  }

  const ffaUrl = process.env.FFA_URL;
  if (!ffaUrl) {
    throw new Error("La comunidad de peñas no está configurada todavía.");
  }

  const { data, error } = await createAdminClient().auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  if (error || !data?.properties?.hashed_token) {
    throw new Error("No se pudo generar el acceso a la comunidad.");
  }

  const destino = new URL("/entrar-desde-pena", ffaUrl);
  destino.searchParams.set("token_hash", data.properties.hashed_token);
  destino.searchParams.set("type", "magiclink");
  redirect(destino.toString());
}
