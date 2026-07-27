import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import ListaMusica, { type PistaListada } from "@/components/ListaMusica";
import PanelSubirMusica from "@/components/PanelSubirMusica";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Música",
  description:
    "Sesiones y canciones de la peña Vicios & Placeres. Escucha sin parar mientras navegas.",
};

export default async function MusicaPage() {
  const supabase = await createClient();
  const sesion = await getSesion();

  const { data: pistas } = await supabase
    .from("pistas")
    .select(
      "id, titulo, artista, tipo, anio, origen, url, embed_url, duracion_s, autores(nombre, avatar_url)",
    )
    .order("created_at", { ascending: false });

  type RelAutor = { nombre: string | null; avatar_url: string | null };
  const conAutor: PistaListada[] = (pistas ?? []).map((p) => {
    const rel = p.autores as unknown as RelAutor | RelAutor[] | null;
    const autor = Array.isArray(rel) ? rel[0] : rel;
    return {
      ...p,
      subidoPorNombre: autor?.nombre ?? null,
      subidoPorAvatar: autor?.avatar_url ?? null,
    } as PistaListada;
  });

  return (
    <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold sm:text-3xl">Música</h1>
        <p className="mt-2 mb-6 text-sm text-white/50">
          Sesiones y canciones de la peña. Puedes seguir navegando: la música no
          se corta.
        </p>

        {sesion?.esMiembro && <PanelSubirMusica />}

        <ListaMusica pistas={conAutor} />
      </div>
    </main>
  );
}
