import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Play } from "lucide-react";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { autorDe } from "@/lib/relaciones";
import PanelSubirGaleria from "@/components/PanelSubirGaleria";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ anio: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { anio } = await params;
  return {
    title: `Fiestas de ${anio}`,
    description: `Fotos y vídeos de las fiestas de ${anio} de la peña Vicios & Placeres.`,
    alternates: { canonical: `/galeria/${anio}` },
  };
}

export default async function AnioPage({ params }: Props) {
  const { anio } = await params;
  const anioNum = Number(anio);

  if (!Number.isInteger(anioNum) || anioNum < 2010 || anioNum > 2100) {
    notFound();
  }

  const supabase = await createClient();
  const sesion = await getSesion();
  const { data: media } = await supabase
    .from("media")
    .select("id, tipo, url, thumb_url, descripcion, autores(nombre, avatar_url)")
    .eq("anio", anioNum)
    .order("created_at", { ascending: false });

  return (
    <main className="flex-1 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/galeria"
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-1 text-sm text-white/60 transition-colors duration-200 hover:text-white"
        >
          <ChevronLeft size={18} aria-hidden="true" />
          Todos los años
        </Link>

        <h1 className="mt-2 mb-6 text-2xl font-semibold tabular-nums sm:text-3xl">
          Fiestas de {anioNum}
        </h1>

        {sesion?.esMiembro && (
          <PanelSubirGaleria
            etiqueta={`Subir a ${anioNum}`}
            anioInicial={anioNum}
          />
        )}

        {!media?.length ? (
          <p className="mt-10 text-white/50">
            Todavía no hay nada de este año.
          </p>
        ) : (
          <ul className="mt-6 grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-5">
            {media.map((m) => {
              const autor = autorDe(m.autores);

              return (
                <li key={m.id}>
                  <Link
                    href={`/galeria/${anioNum}/${m.id}`}
                    className="group relative block aspect-square cursor-pointer overflow-hidden rounded-md bg-white/5"
                  >
                    <Image
                      src={m.thumb_url || m.url}
                      alt={m.descripcion || `Fiestas de ${anioNum}`}
                      fill
                      sizes="(max-width: 640px) 33vw, 20vw"
                      className="object-cover transition-opacity duration-200 group-hover:opacity-80"
                    />
                    <span className="absolute bottom-1.5 left-1.5">
                      <Avatar
                        nombre={autor.nombre}
                        avatarUrl={autor.avatarUrl}
                        tamano={22}
                        className="border-black/60"
                      />
                    </span>
                    {m.tipo === "video" && (
                      <span className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70">
                        <Play size={12} className="ml-0.5" aria-hidden="true" />
                        <span className="sr-only">Vídeo</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
