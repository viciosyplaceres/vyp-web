import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { autorDe } from "@/lib/relaciones";
import Comentarios, { type Comentario } from "@/components/Comentarios";
import Avatar from "@/components/Avatar";
import NavegadorFoto from "@/components/NavegadorFoto";

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

  // Los comentarios se piden a la vez que la propia foto, no después: no
  // dependen de ella (se filtran por el id que ya viene en la URL), así que
  // encadenarlos solo sumaba una ida y vuelta a la espera.
  const [{ data: media }, { data: filas }] = await Promise.all([
    supabase
      .from("media")
      .select(
        "id, tipo, anio, url, ancho, alto, descripcion, created_at, autores(nombre, avatar_url)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("comentarios")
      .select("id, texto, created_at, autor_id, autores(nombre, avatar_url)")
      .eq("media_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (!media) notFound();

  const [{ data: anterior }, { data: siguiente }] =
    media.tipo === "foto"
      ? await Promise.all([
          supabase
            .from("media")
            .select("id")
            .eq("anio", media.anio)
            .eq("tipo", "foto")
            .lt("created_at", media.created_at)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("media")
            .select("id")
            .eq("anio", media.anio)
            .eq("tipo", "foto")
            .gt("created_at", media.created_at)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle(),
        ])
      : [{ data: null }, { data: null }];

  const subidoPor = autorDe(media.autores);

  const comentarios: Comentario[] = (filas ?? []).map((c) => {
    const info = autorDe(c.autores);
    return {
      id: c.id,
      texto: c.texto,
      created_at: c.created_at,
      autor: info.nombre,
      avatarUrl: info.avatarUrl,
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
            <NavegadorFoto
              src={media.url}
              alt={media.descripcion || `Fiestas de ${media.anio}`}
              ancho={media.ancho || 1600}
              alto={media.alto || 1200}
              anterior={anterior ? `/galeria/${media.anio}/${anterior.id}` : null}
              siguiente={siguiente ? `/galeria/${media.anio}/${siguiente.id}` : null}
            />
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Avatar
            nombre={subidoPor.nombre}
            avatarUrl={subidoPor.avatarUrl}
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
