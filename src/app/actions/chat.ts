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
};

/**
 * Guarda el mensaje y **devuelve la fila creada**. El cliente la añade a la
 * lista directamente, sin esperar al canal en vivo: así el mensaje propio
 * aparece siempre, aunque el tiempo real falle o tarde.
 */
export async function enviarMensaje(
  texto: string,
): Promise<MensajeCreado | null> {
  const sesion = await exigirMiembro();

  const limpio = texto.trim();
  if (!limpio) return null;
  if (limpio.length > 4000) {
    throw new Error("El mensaje es demasiado largo.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mensajes")
    .insert({ autor_id: sesion.userId, texto: limpio })
    .select("id, texto, created_at, autor_id")
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

  return { ...data, autor: sesion.nombre };
}

export async function borrarMensaje(id: string) {
  await exigirMiembro();
  const supabase = await createClient();
  const { error } = await supabase.from("mensajes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
