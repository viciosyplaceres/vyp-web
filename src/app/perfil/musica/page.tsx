import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import MiMusica, { type MiPista } from "@/components/MiMusica";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mi música",
  robots: { index: false, follow: false },
};

export default async function MiMusicaPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/login?next=/perfil/musica");
  if (!sesion.esMiembro) redirect("/perfil");

  const supabase = await createClient();
  const { data: pistas } = await supabase
    .from("pistas")
    .select("id, titulo, artista, tipo, origen")
    .eq("subido_por", sesion.userId)
    .order("created_at", { ascending: false });

  return (
    <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/perfil"
          className="mb-5 inline-flex cursor-pointer items-center gap-1.5 text-sm text-white/50 transition-colors duration-200 hover:text-white"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Mi perfil
        </Link>
        <h1 className="mb-1 text-2xl font-semibold sm:text-3xl">Mi música</h1>
        <p className="mb-6 text-sm text-white/50">
          Toda la música que has subido. Puedes borrar la tuya cuando
          quieras.
        </p>
        <MiMusica pistas={(pistas ?? []) as MiPista[]} />
      </div>
    </main>
  );
}
