import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { autorDe } from "@/lib/relaciones";
import ListaMusica, { type PistaListada } from "@/components/ListaMusica";
import PanelSubirMusica from "@/components/PanelSubirMusica";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Música",
  description:
    "Sesiones y canciones de la peña Vicios & Placeres. Escucha sin parar mientras navegas.",
  alternates: { canonical: "/musica" },
};

export default async function MusicaPage() {
  const supabase = await createClient();
  const sesion = await getSesion();

  const { data: pistas } = await supabase
    .from("pistas")
    .select(
      "id, titulo, artista, tipo, anio, origen, url, embed_url, duracion_s, subido_por, autores(nombre, avatar_url)",
    )
    .order("created_at", { ascending: false });

  const conAutor: PistaListada[] = (pistas ?? []).map((p) => {
    const autor = autorDe(p.autores);
    return {
      ...p,
      subidoPorId: p.subido_por,
      subidoPorNombre: autor.nombre,
      subidoPorAvatar: autor.avatarUrl,
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
