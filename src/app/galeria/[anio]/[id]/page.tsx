import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import Comentarios, { type Comentario } from "@/components/Comentarios";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ anio: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { anio } = await params;
  return { title: `Fiestas de ${anio}` };
}

export default async function DetalleMediaPage({ params }: Props) {
  const { anio, id } = await params;
  const anioNum = Number(anio);

  const supabase = await createClient();
  const sesion = await getSesion();

  const { data: media } = await supabase
    .from("media")
    .select(
      "id, tipo, anio, url, ancho, alto, descripcion, created_at, autores(nombre, avatar_url)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!media) notFound();

  type RelAutor = { nombre: string | null; avatar_url: string | null };
  const relSubidoPor = media.autores as unknown as RelAutor | RelAutor[] | null;
  const subidoPor = Array.isArray(relSubidoPor) ? relSubidoPor[0] : relSubidoPor;

  const { data: filas } = await supabase
    .from("comentarios")
    .select("id, texto, created_at, autor_id, autores(nombre, avatar_url)")
    .eq("media_id", id)
    .order("created_at", { ascending: true });

  const comentarios: Comentario[] = (filas ?? []).map((c) => {
    // La relación viene como objeto o array según la inferencia de PostgREST.
    const rel = c.autores as unknown as RelAutor | RelAutor[] | null;
    const info = Array.isArray(rel) ? rel[0] : rel;
    return {
      id: c.id,
      texto: c.texto,
      created_at: c.created_at,
      autor: info?.nombre ?? null,
      avatarUrl: info?.avatar_url ?? null,
    };
  });

  return (
    <main className="flex-1 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/galeria/${media.anio}`}
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-1 text-sm text-white/60 transition-colors duration-200 hover:text-white"
        >
          <ChevronLeft size={18} aria-hidden="true" />
          Fiestas de {media.anio}
        </Link>

        <div className="mt-2 overflow-hidden rounded-xl bg-white/5">
          {media.tipo === "video" ? (
            <video
              src={media.url}
              controls
              playsInline
              preload="metadata"
              className="h-auto w-full"
            />
          ) : (
            <Image
              src={media.url}
              alt={media.descripcion || `Fiestas de ${media.anio}`}
              width={media.ancho || 1600}
              height={media.alto || 1200}
              sizes="(max-width: 768px) 100vw, 768px"
              className="h-auto w-full"
              priority
            />
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Avatar
            nombre={subidoPor?.nombre ?? null}
            avatarUrl={subidoPor?.avatar_url ?? null}
            tamano={28}
          />
          <p className="text-sm text-white/60">
            Subido por{" "}
            <span className="font-medium text-white">
              {subidoPor?.nombre ?? "un miembro"}
            </span>
          </p>
        </div>

        {media.descripcion && (
          <p className="mt-3 text-sm text-white/70">{media.descripcion}</p>
        )}

        <Comentarios
          mediaId={media.id}
          anio={anioNum}
          comentarios={comentarios}
          esMiembro={sesion?.esMiembro ?? false}
          haySesion={Boolean(sesion)}
        />
      </div>
    </main>
  );
}
