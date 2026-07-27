"use server";

import { createClient } from "@/lib/supabase/server";
import { exigirMiembro } from "@/lib/auth";
import { avisarMiembros } from "@/lib/push";

export async function enviarMensaje(texto: string) {
  const sesion = await exigirMiembro();

  const limpio = texto.trim();
  if (!limpio) return;
  if (limpio.length > 4000) {
    throw new Error("El mensaje es demasiado largo.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("mensajes").insert({
    autor_id: sesion.userId,
    texto: limpio,
  });

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
}

export async function borrarMensaje(id: string) {
  await exigirMiembro();
  const supabase = await createClient();
  const { error } = await supabase.from("mensajes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
