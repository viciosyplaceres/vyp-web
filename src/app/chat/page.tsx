import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { marcarChatLeido } from "@/app/actions/chat";
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
    { data: reaccionesFilas },
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
        .select(
          "id, texto, created_at, autor_id, respuesta_a, respuesta_texto, respuesta_autor, editado_at, borrado, autores!mensajes_autor_id_fkey(nombre, avatar_url)",
        )
        .order("created_at", { ascending: true })
        .limit(200),
      supabase.from("autores").select("id, nombre, avatar_url"),
      supabase.from("mensaje_reacciones").select("mensaje_id, perfil_id, emoji"),
      supabase.from("chat_lecturas").select("perfil_id, ultimo_leido_at"),
    ]);

  // Si la consulta falla, que quede constancia en los logs en vez de fingir
  // silenciosamente que la conversación está vacía (justo lo que pasó aquí).
  if (errorMensajes) {
    console.error("Error al cargar mensajes del chat:", errorMensajes.message);
  }

  type RelAutor = { nombre: string | null; avatar_url: string | null };

  const mensajes: Mensaje[] = (filas ?? []).map((m) => {
    const rel = m.autores as unknown as RelAutor | RelAutor[] | null;
    const info = Array.isArray(rel) ? rel[0] : rel;
    return {
      id: m.id,
      texto: m.texto,
      created_at: m.created_at,
      autor_id: m.autor_id,
      autor: info?.nombre ?? null,
      avatarUrl: info?.avatar_url ?? null,
      respuestaA: m.respuesta_a,
      respuestaTexto: m.respuesta_texto,
      respuestaAutor: m.respuesta_autor,
      editadoAt: m.editado_at,
      borrado: m.borrado,
    };
  });

  // Índice de autores para poder etiquetar los mensajes que llegan en vivo,
  // que solo traen el autor_id.
  const autores: Record<string, InfoAutor> = {};
  for (const a of todosAutores ?? []) {
    autores[a.id] = { nombre: a.nombre, avatarUrl: a.avatar_url };
  }

  const reaccionesIniciales: Record<string, { emoji: string; perfilId: string; nombre: string | null }[]> = {};
  for (const r of reaccionesFilas ?? []) {
    (reaccionesIniciales[r.mensaje_id] ??= []).push({
      emoji: r.emoji,
      perfilId: r.perfil_id,
      nombre: autores[r.perfil_id]?.nombre ?? null,
    });
  }

  const lecturas: Record<string, string> = {};
  for (const l of lecturasFilas ?? []) {
    lecturas[l.perfil_id] = l.ultimo_leido_at;
  }

  // Entrar al chat cuenta como haberlo leído hasta ahora: la burbuja de no
  // leídos del menú inferior baja a cero y el doble check azul avisa a los
  // demás de que sus mensajes ya se han visto.
  await marcarChatLeido().catch(() => undefined);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 sm:px-6">
      <div className="border-b border-white/10 py-4">
        <h1 className="text-xl font-semibold">Chat de la peña</h1>
        <p className="text-xs text-white/40">
          Privado. Solo lo ven los miembros aprobados.
        </p>
      </div>

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
