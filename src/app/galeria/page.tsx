import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import PanelSubirGaleria from "@/components/PanelSubirGaleria";
import { obtenerAnioActivo } from "@/app/actions/configuracion";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Galería",
  description:
    "Fotos y vídeos de las fiestas de la peña Vicios & Placeres, año por año.",
  alternates: { canonical: "/galeria" },
};

type ResumenAnio = {
  anio: number;
  total: number;
  portada: string | null;
};

export default async function GaleriaPage() {
  const supabase = await createClient();
  const [sesion, anioActivo, { data: media }] = await Promise.all([
    getSesion(),
    obtenerAnioActivo(),
    supabase
      .from("media")
      .select("anio, url, thumb_url, created_at")
      .order("created_at", { ascending: false }),
  ]);

  // Se agrupa por año en el servidor: son pocas filas y evita una vista extra.
  const porAnio = new Map<number, ResumenAnio>();
  for (const m of media ?? []) {
    const actual = porAnio.get(m.anio);
    if (actual) {
      actual.total += 1;
    } else {
      porAnio.set(m.anio, {
        anio: m.anio,
        total: 1,
        portada: m.thumb_url || m.url,
      });
    }
  }

  const anios = [...porAnio.values()].sort((a, b) => b.anio - a.anio);

  return (
    <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold sm:text-3xl">Galería</h1>
        <p className="mt-2 mb-6 text-sm text-white/50">
          Las fiestas son una vez al año. Cada año, su carpeta.
        </p>

        {sesion?.esMiembro && <PanelSubirGaleria anioInicial={anioActivo} />}

        {anios.length === 0 ? (
          <p className="mt-10 text-white/50">
            {sesion?.esMiembro
              ? "Todavía no hay nada subido. Sube las primeras fotos con el botón de arriba."
              : "Todavía no hay nada subido."}
          </p>
        ) : (
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {anios.map(({ anio, total, portada }) => (
              <li key={anio}>
                <Link
                  href={`/galeria/${anio}`}
                  className="group block cursor-pointer overflow-hidden rounded-xl border border-white/10 transition-colors duration-200 hover:border-white/30"
                >
                  <div className="relative aspect-[4/3] bg-white/5">
                    {portada && (
                      <Image
                        src={portada}
                        alt={`Fiestas de ${anio}`}
                        fill
                        sizes="(max-width: 640px) 50vw, 25vw"
                        className="object-cover opacity-80 transition-opacity duration-200 group-hover:opacity-100"
                      />
                    )}
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-lg font-semibold tabular-nums">{anio}</p>
                    <p className="text-xs text-white/50">
                      {total} {total === 1 ? "archivo" : "archivos"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
