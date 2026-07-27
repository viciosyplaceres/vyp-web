import Image from "next/image";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Play, Music } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSesion } from "@/lib/auth";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Perfil",
  robots: { index: false, follow: false },
};

export default async function PerfilPublicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sesion = await getSesion();
  if (!sesion) redirect(`/login?next=/miembros/${id}`);
  if (!sesion.esMiembro) redirect("/perfil");

  const supabase = await createClient();

  // Mismo motivo que en /miembros: RLS solo deja ver el perfil propio.
  const { data: perfil } = await createAdminClient()
    .from("perfiles")
    .select("id, nombre, usuario, avatar_url, bio, rol, aprobado")
    .eq("id", id)
    .eq("aprobado", true)
    .maybeSingle();

  if (!perfil) notFound();

  const esYoMismo = perfil.id === sesion.userId;

  const [{ data: fotos }, { data: pistas }] = await Promise.all([
    supabase
      .from("media")
      .select("id, anio, tipo, url, thumb_url, descripcion")
      .eq("subido_por", id)
      .order("created_at", { ascending: false })
      .limit(9),
    supabase
      .from("pistas")
      .select("id, titulo, artista, tipo")
      .eq("subido_por", id)
      .order("created_at", { ascending: false })
      .limit(9),
  ]);

  return (
    <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl space-y-10">
        <div>
          <Link
            href="/miembros"
            className="mb-5 inline-flex cursor-pointer items-center gap-1.5 text-sm text-white/50 transition-colors duration-200 hover:text-white"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            Miembros
          </Link>

          <div className="flex items-center gap-4">
            <Avatar nombre={perfil.nombre} avatarUrl={perfil.avatar_url} tamano={72} />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold">
                {perfil.nombre || "(sin nombre)"}
                {esYoMismo && <span className="text-white/40"> (tú)</span>}
              </h1>
              {perfil.usuario && (
                <p className="truncate text-sm text-white/50">@{perfil.usuario}</p>
              )}
              <p className="text-xs text-white/40">
                {perfil.rol === "admin" ? "Directiva" : "Miembro"} de la peña
              </p>
            </div>
          </div>

          {perfil.bio && (
            <p className="mt-4 whitespace-pre-wrap text-sm text-white/70">
              {perfil.bio}
            </p>
          )}
        </div>

        <section className="border-t border-white/10 pt-8">
          <h2 className="text-lg font-semibold">Fotos y vídeos</h2>
          {!fotos?.length ? (
            <p className="mt-2 text-sm text-white/40">Todavía no ha subido nada.</p>
          ) : (
            <ul className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2">
              {fotos.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/galeria/${f.anio}/${f.id}`}
                    className="group relative block aspect-square cursor-pointer overflow-hidden rounded-md bg-white/5"
                  >
                    <Image
                      src={f.thumb_url || f.url}
                      alt={f.descripcion || `Foto de ${f.anio}`}
                      fill
                      sizes="(max-width: 640px) 33vw, 25vw"
                      className="object-cover transition-opacity duration-200 group-hover:opacity-80"
                    />
                    {f.tipo === "video" && (
                      <span className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70">
                        <Play size={12} className="ml-0.5" aria-hidden="true" />
                        <span className="sr-only">Vídeo</span>
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border-t border-white/10 pt-8">
          <h2 className="text-lg font-semibold">Música</h2>
          {!pistas?.length ? (
            <p className="mt-2 text-sm text-white/40">Todavía no ha subido música.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {pistas.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5"
                >
                  <Music size={16} className="shrink-0 text-white/40" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.titulo}</p>
                    <p className="truncate text-xs text-white/50">
                      {[p.artista, p.tipo === "sesion" ? "Sesión" : "Canción"]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
