import Link from "next/link";
import type { Metadata } from "next";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import Chat, { type Mensaje, type InfoAutor } from "@/components/Chat";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chat de la peña",
  robots: { index: false, follow: false },
};

export default async function ChatPage() {
  const sesion = await getSesion();

  // El chat no existe para quien no es miembro: ni el contenido ni la lista.
  // La base de datos lo impide igualmente (ni siquiera hay permiso para `anon`).
  if (!sesion) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16 text-center">
        <div className="max-w-sm space-y-3">
          <h1 className="text-xl font-semibold">Chat de la peña</h1>
          <p className="text-white/60">
            Este chat es solo para miembros de la peña.
          </p>
          <Link
            href="/login?next=/chat"
            className="inline-flex min-h-[44px] cursor-pointer items-center rounded-full bg-white px-5 text-sm font-medium text-black"
          >
            Acceder
          </Link>
        </div>
      </main>
    );
  }

  if (!sesion.esMiembro) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16 text-center">
        <div className="max-w-sm space-y-3">
          <h1 className="text-xl font-semibold">Chat de la peña</h1>
          <p className="text-white/60">
            Tu cuenta todavía está pendiente de que la directiva la apruebe.
            Cuando te aprueben, este chat se abre solo.
          </p>
        </div>
      </main>
    );
  }

  const supabase = await createClient();

  const [
    { data: filas, error: errorMensajes },
    { data: todosAutores },
    { data: lecturasFilas },
  ] = await Promise.all([
      supabase
        .from("mensajes")
        // La relación se nombra explícitamente ("!mensajes_autor_id_fkey"):
        // desde que existe `mensaje_reacciones` (también enlazada a
        // `mensajes` y a `perfiles`), PostgREST encuentra DOS caminos
        // posibles hasta `autores` y, sin desambiguar, rechaza la consulta
        // entera con un error. Aquí no se comprobaba ese error, así que el
        // chat se quedaba en silencio mostrando "Aún no hay mensajes" aunque
        // la conversación seguía intacta en la base de datos.
        //
        // Las reacciones vienen dentro de cada mensaje en vez de en una
        // consulta aparte: así se traen justo las de los mensajes que se van
        // a pintar (antes se descargaban las de toda la historia del chat) y
        // se ahorra un viaje a la base de datos.
        .select(
          "id, texto, created_at, autor_id, respuesta_a, respuesta_texto, respuesta_autor, editado_at, borrado, mensaje_reacciones(perfil_id, emoji)",
        )
        // Los últimos 200, no los 200 primeros: ordenar ascendente con
        // `limit` dejaba fuera la conversación reciente en cuanto el chat
        // pasara de 200 mensajes. Se le da la vuelta abajo para pintarlos en
        // orden de lectura.
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("autores").select("id, nombre, avatar_url"),
      supabase.from("chat_lecturas").select("perfil_id, ultimo_leido_at"),
    ]);

  // Si la consulta falla, que quede constancia en los logs en vez de fingir
  // silenciosamente que la conversación está vacía (justo lo que pasó aquí).
  if (errorMensajes) {
    console.error("Error al cargar mensajes del chat:", errorMensajes.message);
  }

  const recientesPrimero = filas ?? [];
  const enOrden = [...recientesPrimero].reverse();

  // Un único índice sirve para pintar los 200 mensajes y para resolver los
  // eventos en vivo. Antes cada mensaje repetía su autor dentro de la consulta
  // principal y además se descargaba esta misma lista por separado.
  const autores: Record<string, InfoAutor> = {};
  for (const autor of todosAutores ?? []) {
    autores[autor.id] = { nombre: autor.nombre, avatarUrl: autor.avatar_url };
  }

  const mensajes: Mensaje[] = enOrden.map((m) => {
    const info = autores[m.autor_id];
    return {
      id: m.id,
      texto: m.texto,
      created_at: m.created_at,
      autor_id: m.autor_id,
      autor: info?.nombre ?? null,
      avatarUrl: info?.avatarUrl ?? null,
      respuestaA: m.respuesta_a,
      respuestaTexto: m.respuesta_texto,
      respuestaAutor: m.respuesta_autor,
      editadoAt: m.editado_at,
      borrado: m.borrado,
    };
  });

  const reaccionesIniciales: Record<string, { emoji: string; perfilId: string; nombre: string | null }[]> = {};
  for (const m of enOrden) {
    for (const r of m.mensaje_reacciones ?? []) {
      (reaccionesIniciales[m.id] ??= []).push({
        emoji: r.emoji,
        perfilId: r.perfil_id,
        nombre: autores[r.perfil_id]?.nombre ?? null,
      });
    }
  }

  const lecturas: Record<string, string> = {};
  for (const l of lecturasFilas ?? []) {
    lecturas[l.perfil_id] = l.ultimo_leido_at;
  }

  // La interfaz ya pone la burbuja a cero al entrar. La escritura persistente
  // se hace después de enviar la respuesta para no retrasar la apertura del
  // chat; el cliente de Supabase ya fue creado con la sesión validada.
  after(async () => {
    const { error } = await supabase.from("chat_lecturas").upsert(
      { perfil_id: sesion.userId, ultimo_leido_at: new Date().toISOString() },
      { onConflict: "perfil_id" },
    );
    if (error) console.error("Error al marcar el chat como leído:", error.message);
  });

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-hidden px-4 sm:px-6">
      <Chat
        inicial={mensajes}
        userId={sesion.userId}
        autores={autores}
        reaccionesIniciales={reaccionesIniciales}
        lecturasIniciales={lecturas}
      />
    </main>
  );
}
