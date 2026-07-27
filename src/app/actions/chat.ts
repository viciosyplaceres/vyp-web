"use server";

import { createClient } from "@/lib/supabase/server";
import { exigirMiembro } from "@/lib/auth";
import { avisarMiembros } from "@/lib/push";

export type MensajeCreado = {
  id: string;
  texto: string;
  created_at: string;
  autor_id: string;
  autor: string | null;
  avatarUrl: string | null;
  respuestaA: string | null;
  respuestaTexto: string | null;
  respuestaAutor: string | null;
  editadoAt: string | null;
  borrado: boolean;
};

/**
 * Guarda el mensaje y **devuelve la fila creada**. El cliente la añade a la
 * lista directamente, sin esperar al canal en vivo: así el mensaje propio
 * aparece siempre, aunque el tiempo real falle o tarde.
 */
export async function enviarMensaje(
  texto: string,
  respuestaA?: string | null,
): Promise<MensajeCreado | null> {
  const sesion = await exigirMiembro();

  const limpio = texto.trim();
  if (!limpio) return null;
  if (limpio.length > 4000) {
    throw new Error("El mensaje es demasiado largo.");
  }

  const supabase = await createClient();

  // El texto/autor citado se copia en el momento de responder: si el
  // original se edita o se borra después, la cita no cambia por su cuenta
  // (igual que en WhatsApp, que congela lo que se ve en la respuesta).
  let respuestaTexto: string | null = null;
  let respuestaAutor: string | null = null;
  if (respuestaA) {
    const { data: original } = await supabase
      .from("mensajes")
      .select("texto, borrado, autores(nombre)")
      .eq("id", respuestaA)
      .single();
    if (original) {
      type RelAutor = { nombre: string | null };
      const rel = original.autores as unknown as RelAutor | RelAutor[] | null;
      const autor = Array.isArray(rel) ? rel[0] : rel;
      respuestaTexto = original.borrado ? "Mensaje eliminado" : original.texto;
      respuestaAutor = autor?.nombre ?? null;
    }
  }

  const { data, error } = await supabase
    .from("mensajes")
    .insert({
      autor_id: sesion.userId,
      texto: limpio,
      respuesta_a: respuestaA ?? null,
      respuesta_texto: respuestaTexto,
      respuesta_autor: respuestaAutor,
    })
    .select("id, texto, created_at, autor_id, respuesta_a, respuesta_texto, respuesta_autor, editado_at, borrado")
    .single();

  if (error) throw new Error(error.message);

  // El aviso no debe tumbar el envío si falla el servicio de notificaciones.
  try {
    await avisarMiembros(
      {
        titulo: sesion.nombre ? `${sesion.nombre} · VYP` : "Nuevo mensaje · VYP",
        cuerpo: limpio.slice(0, 120),
        url: "/chat",
      },
      sesion.userId,
    );
  } catch {
    // silencioso a propósito
  }

  return {
    id: data.id,
    texto: data.texto,
    created_at: data.created_at,
    autor_id: data.autor_id,
    autor: sesion.nombre,
    avatarUrl: sesion.avatarUrl,
    respuestaA: data.respuesta_a,
    respuestaTexto: data.respuesta_texto,
    respuestaAutor: data.respuesta_autor,
    editadoAt: data.editado_at,
    borrado: data.borrado,
  };
}

/** Edita el texto de un mensaje propio. La base de datos impide tocar el ajeno. */
export async function editarMensaje(id: string, texto: string) {
  const limpio = texto.trim();
  if (!limpio) throw new Error("El mensaje no puede quedar vacío.");
  if (limpio.length > 4000) throw new Error("El mensaje es demasiado largo.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("mensajes")
    .update({ texto: limpio, editado_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

/**
 * Borrado blando: deja "Mensaje eliminado" en su sitio en vez de dejar un
 * hueco sin explicación, igual que WhatsApp.
 */
export async function borrarMensaje(id: string) {
  await exigirMiembro();
  const supabase = await createClient();
  // El texto se deja tal cual en la base de datos (la columna exige entre 1 y
  // 4000 caracteres): la interfaz es la que oculta el contenido y muestra
  // "Mensaje eliminado" en cuanto `borrado` es true.
  const { error } = await supabase
    .from("mensajes")
    .update({ borrado: true })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Pone o quita tu reacción a un mensaje (una por persona, como WhatsApp). */
export async function reaccionar(mensajeId: string, emoji: string) {
  const sesion = await exigirMiembro();
  const supabase = await createClient();

  const { data: mia } = await supabase
    .from("mensaje_reacciones")
    .select("emoji")
    .eq("mensaje_id", mensajeId)
    .eq("perfil_id", sesion.userId)
    .maybeSingle();

  if (mia?.emoji === emoji) {
    const { error } = await supabase
      .from("mensaje_reacciones")
      .delete()
      .eq("mensaje_id", mensajeId)
      .eq("perfil_id", sesion.userId);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase
    .from("mensaje_reacciones")
    .upsert(
      { mensaje_id: mensajeId, perfil_id: sesion.userId, emoji },
      { onConflict: "mensaje_id,perfil_id" },
    );
  if (error) throw new Error(error.message);
}

/** Marca la conversación como leída hasta ahora mismo (doble check + burbuja). */
export async function marcarChatLeido() {
  const sesion = await exigirMiembro();
  const supabase = await createClient();
  const { error } = await supabase
    .from("chat_lecturas")
    .upsert(
      { perfil_id: sesion.userId, ultimo_leido_at: new Date().toISOString() },
      { onConflict: "perfil_id" },
    );
  if (error) throw new Error(error.message);
}

/** Cuántos mensajes de otros hay por leer, para la burbuja del menú inferior. */
export async function obtenerNoLeidos(): Promise<number> {
  const sesion = await exigirMiembro();
  const supabase = await createClient();

  const { data: lectura } = await supabase
    .from("chat_lecturas")
    .select("ultimo_leido_at")
    .eq("perfil_id", sesion.userId)
    .maybeSingle();

  let consulta = supabase
    .from("mensajes")
    .select("id", { count: "exact", head: true })
    .neq("autor_id", sesion.userId);

  if (lectura?.ultimo_leido_at) {
    consulta = consulta.gt("created_at", lectura.ultimo_leido_at);
  }

  const { count } = await consulta;
  return count ?? 0;
}
