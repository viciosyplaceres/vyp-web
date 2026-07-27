import Link from "next/link";
import type { Metadata } from "next";
import { getSesion } from "@/lib/auth";
import SubirMedia from "@/components/SubirMedia";
import SubirMusica from "@/components/SubirMusica";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Subir",
  robots: { index: false, follow: false },
};

export default async function SubirPage() {
  const sesion = await getSesion();

  if (!sesion) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16 text-center">
        <div className="max-w-sm space-y-3">
          <h1 className="text-xl font-semibold">Subir contenido</h1>
          <p className="text-white/60">Solo los miembros de la peña suben.</p>
          <Link
            href="/login?next=/subir"
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
          <h1 className="text-xl font-semibold">Subir contenido</h1>
          <p className="text-white/60">
            Tu cuenta está pendiente de que la directiva la apruebe. Hasta
            entonces puedes ver y escuchar todo, pero no subir.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-lg space-y-12">
        <section>
          <h1 className="text-2xl font-semibold">Subir a la galería</h1>
          <p className="mt-1 mb-6 text-sm text-white/50">
            Fotos y vídeos de las fiestas, ordenados por año.
          </p>
          <SubirMedia />
        </section>

        <section className="border-t border-white/10 pt-10">
          <h2 className="text-2xl font-semibold">Añadir música</h2>
          <p className="mt-1 mb-6 text-sm text-white/50">
            Sube una sesión o canción, o pega el enlace si ya está en Mixcloud o
            SoundCloud.
          </p>
          <SubirMusica />
        </section>
      </div>
    </main>
  );
}
