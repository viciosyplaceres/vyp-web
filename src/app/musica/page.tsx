import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import ListaMusica, { type PistaListada } from "@/components/ListaMusica";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Música",
  description:
    "Sesiones y canciones de la peña Vicios & Placeres. Escucha sin parar mientras navegas.",
};

export default async function MusicaPage() {
  const supabase = await createClient();

  const { data: pistas } = await supabase
    .from("pistas")
    .select(
      "id, titulo, artista, tipo, anio, origen, url, embed_url, duracion_s",
    )
    .order("created_at", { ascending: false });

  return (
    <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold sm:text-3xl">Música</h1>
        <p className="mt-2 text-sm text-white/50">
          Sesiones y canciones de la peña. Puedes seguir navegando: la música no
          se corta.
        </p>

        <ListaMusica pistas={(pistas ?? []) as PistaListada[]} />
      </div>
    </main>
  );
}
