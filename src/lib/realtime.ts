"use client";

import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * Un único canal de Supabase Realtime para toda la app.
 *
 * Antes había tres canales abiertos a la vez (`chat-vyp`, `chat-badge-vyp` y
 * `pendientes-perfil-vyp`), cada uno con su propio `getSession()` y su propio
 * `setAuth`. Dos de ellos escuchaban exactamente lo mismo —los mensajes
 * nuevos—, así que cada mensaje del chat llegaba **dos veces** por el
 * WebSocket y se contaba dos veces en la cuota del plan gratuito.
 *
 * Aquí se registran los oyentes, se suman sus escuchas y se abre un solo
 * canal con la unión de todas. Si alguien se suscribe pidiendo una escucha
 * nueva (por ejemplo al entrar en el chat), el canal se rehace: los bindings
 * de `postgres_changes` se envían al suscribirse y no se pueden añadir a un
 * canal ya conectado.
 */

export type Escucha = {
  tabla: string;
  evento: "INSERT" | "UPDATE" | "DELETE" | "*";
  filtro?: string;
};

type Fila = Record<string, unknown>;
export type CambioPostgres = RealtimePostgresChangesPayload<Fila>;

type Oyente = {
  escuchas: Escucha[];
  al: (escucha: Escucha, cambio: CambioPostgres) => void;
};

const NOMBRE_CANAL = "vyp";

const oyentes = new Set<Oyente>();
let canal: RealtimeChannel | null = null;
let claveActual = "";
let generacion = 0;

function claveDe(e: Escucha) {
  return `${e.tabla}|${e.evento}|${e.filtro ?? ""}`;
}

/** La unión de escuchas de todos los oyentes vivos, sin repetir. */
function escuchasUnidas(): Escucha[] {
  const mapa = new Map<string, Escucha>();
  for (const o of oyentes) {
    for (const e of o.escuchas) mapa.set(claveDe(e), e);
  }
  return [...mapa.values()].sort((a, b) => claveDe(a).localeCompare(claveDe(b)));
}

function repartir(escucha: Escucha, cambio: CambioPostgres) {
  const clave = claveDe(escucha);
  for (const o of oyentes) {
    const suya = o.escuchas.find((e) => claveDe(e) === clave);
    if (suya) o.al(suya, cambio);
  }
}

async function reconciliar() {
  const escuchas = escuchasUnidas();
  const clave = escuchas.map(claveDe).join("&");
  if (clave === claveActual) return;

  const mia = ++generacion;
  claveActual = clave;

  const supabase = createClient();
  if (canal) {
    const viejo = canal;
    canal = null;
    void supabase.removeChannel(viejo);
  }
  if (escuchas.length === 0) return;

  // Sin el token del usuario, Supabase entrega los eventos vacíos con un
  // "Error 401": estas tablas solo las pueden leer los miembros.
  const { data } = await supabase.auth.getSession();
  if (data.session) await supabase.realtime.setAuth(data.session.access_token);
  if (mia !== generacion) return;

  let nuevo = supabase.channel(NOMBRE_CANAL);
  for (const escucha of escuchas) {
    nuevo = nuevo.on<Fila>(
      "postgres_changes",
      {
        event: escucha.evento,
        schema: "public",
        table: escucha.tabla,
        ...(escucha.filtro ? { filter: escucha.filtro } : {}),
      },
      (cambio) => repartir(escucha, cambio),
    );
  }
  canal = nuevo.subscribe();
}

/**
 * Registra un oyente y devuelve la función para darlo de baja. Las escuchas
 * deben ser estables entre renders (memorizadas o constantes).
 */
export function suscribirRealtime(
  escuchas: Escucha[],
  al: (escucha: Escucha, cambio: CambioPostgres) => void,
): () => void {
  const oyente: Oyente = { escuchas, al };
  oyentes.add(oyente);
  void reconciliar();

  return () => {
    oyentes.delete(oyente);
    void reconciliar();
  };
}
