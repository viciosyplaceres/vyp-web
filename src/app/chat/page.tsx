import Link from "next/link";
import type { Metadata } from "next";
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

  const { data: filas } = await supabase
    .from("mensajes")
    .select("id, texto, created_at, autor_id, autores(nombre, avatar_url)")
    .order("created_at", { ascending: true })
    .limit(200);

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
    };
  });

  // Índice de autores para poder etiquetar los mensajes que llegan en vivo,
  // que solo traen el autor_id.
  const { data: todosAutores } = await supabase
    .from("autores")
    .select("id, nombre, avatar_url");
  const autores: Record<string, InfoAutor> = {};
  for (const a of todosAutores ?? []) {
    autores[a.id] = { nombre: a.nombre, avatarUrl: a.avatar_url };
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 sm:px-6">
      <div className="border-b border-white/10 py-4">
        <h1 className="text-xl font-semibold">Chat de la peña</h1>
        <p className="text-xs text-white/40">
          Privado. Solo lo ven los miembros aprobados.
        </p>
      </div>

      <Chat inicial={mensajes} userId={sesion.userId} autores={autores} />
    </main>
  );
}
