"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { avisarUsuario, avisarMiembros } from "@/lib/push";

async function exigirAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado.");

  const { data: miPerfil } = await supabase
    .from("perfiles")
    .select("rol, aprobado")
    .eq("id", user.id)
    .single();

  if (miPerfil?.rol !== "admin" || !miPerfil.aprobado) {
    throw new Error("No autorizado.");
  }

  return supabase;
}

/**
 * También hace de guardia contra borrar/resetear a un admin por error: se
 * comprueba el rol de la CUENTA OBJETIVO, no de quien pide la acción (eso ya
 * lo hace `exigirAdmin`).
 */
async function exigirObjetivoNoAdmin(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data: objetivo } = await supabase
    .from("perfiles")
    .select("rol, nombre")
    .eq("id", id)
    .single();

  if (objetivo?.rol === "admin") {
    throw new Error("No se puede tocar la cuenta de la directiva desde aquí.");
  }

  return objetivo;
}

export async function aprobarMiembro(id: string) {
  // Chequeo explícito en el server action, ADEMÁS de la política RLS de "perfiles"
  // (que ya exige es_admin() para modificar el perfil de otro): defensa en profundidad.
  const supabase = await exigirAdmin();
  const { data, error } = await supabase
    .from("perfiles")
    .update({ aprobado: true })
    .eq("id", id)
    .select("nombre")
    .maybeSingle();

  if (error) throw new Error(error.message);

  // Aprobar es el verdadero filtro de confianza de esta peña (lo hace la
  // directiva a mano, mirando quién es cada uno); pedir ADEMÁS que confirme
  // el email por correo es un segundo cerrojo redundante que aquí solo hace
  // daño: el envío usa el mailer por defecto de Supabase (sin SMTP propio
  // configurado), que es lento, limitado y a menudo cae en spam o ni llega
  // (le pasó de verdad a un miembro real, aprobado y sin poder entrar). Se
  // confirma el email a la vez que se aprueba, para que la aprobación sea
  // de verdad la única puerta.
  await createAdminClient()
    .auth.admin.updateUserById(id, { email_confirm: true })
    .catch(() => undefined);

  revalidatePath("/admin/miembros");

  // Al recién aprobado: ya puede entrar en todo.
  await avisarUsuario(id, {
    titulo: "¡Ya eres de la peña!",
    cuerpo:
      "La directiva ha aprobado tu cuenta. Ya puedes subir fotos, comentar y entrar en el chat.",
    url: "/",
    tag: "aprobacion",
  });

  // Y al resto de miembros, que hay gente nueva.
  if (data?.nombre) {
    await avisarMiembros(
      {
        titulo: "Nuevo miembro en la peña",
        cuerpo: `${data.nombre} ya forma parte de Vicios & Placeres.`,
        url: "/chat",
        tag: "altas",
      },
      id,
    );
  }
}

export async function revocarMiembro(id: string) {
  const supabase = await exigirAdmin();
  const { error } = await supabase
    .from("perfiles")
    .update({ aprobado: false })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/miembros");
}

// Sin la Ñ, la Ñ minúscula ni caracteres que se confunden a simple vista
// (0/O, 1/l/I): es una contraseña que alguien va a tener que teclear a mano
// desde el mensaje de WhatsApp que le mande la directiva.
const ALFABETO_CONTRASENA = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function generarContrasenaTemporal(longitud = 10) {
  let resultado = "";
  for (let i = 0; i < longitud; i++) {
    resultado += ALFABETO_CONTRASENA[randomInt(ALFABETO_CONTRASENA.length)];
  }
  return resultado;
}

/**
 * Pone una contraseña nueva a un miembro que la ha olvidado. No hay envío de
 * email de por medio (no hay SMTP transaccional configurado): la directiva
 * ve la contraseña una vez en pantalla y se la pasa a mano por WhatsApp o
 * como sea. `service_role` es imprescindible: cambiar la contraseña de OTRA
 * cuenta es cosa de la API de administración de Auth, no de una tabla propia.
 */
export async function resetearContrasena(id: string): Promise<string> {
  const supabase = await exigirAdmin();
  const objetivo = await exigirObjetivoNoAdmin(supabase, id);

  const nueva = generarContrasenaTemporal();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password: nueva });
  if (error) throw new Error(error.message);

  await avisarUsuario(id, {
    titulo: "Tu contraseña ha cambiado",
    cuerpo: `La directiva te ha puesto una contraseña nueva. Pídesela a ${objetivo?.nombre ? "quien te la haya reseteado" : "la directiva"} si no la tienes.`,
    url: "/login",
    tag: "seguridad",
  }).catch(() => undefined);

  return nueva;
}

/**
 * Da de baja a un miembro por completo (para siempre, no es lo mismo que
 * "revocar"): borra su cuenta de Auth y, en cascada, su fila de `perfiles`.
 *
 * Lo que SÍ sobrevive a propósito, porque las columnas están pensadas para
 * eso (`on delete set null` en vez de `cascade`): sus fotos, vídeos y música
 * ya subidos, que se quedan en la galería/música con "subido_por" en null
 * (aparecen como contenido sin autor, no desaparecen). Lo que si desaparece
 * con la cuenta, porque son cosas suyas y no de la peña, son sus comentarios,
 * sus mensajes del chat y sus tareas/compra asignadas.
 */
export async function eliminarMiembro(id: string) {
  await exigirAdmin();
  const admin = createAdminClient();

  await exigirObjetivoNoAdmin(admin, id);

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/miembros");
  revalidatePath("/galeria");
  revalidatePath("/musica");
  revalidatePath("/");
}
