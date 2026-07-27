import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { LogOut, Play, Music } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { cerrarSesion } from "@/app/actions/auth";
import AvisosPush from "@/components/AvisosPush";
import EditarPerfil from "@/components/EditarPerfil";
import MisPendientes, {
  type MiTarea,
  type MiCompra,
} from "@/components/MisPendientes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mi perfil",
  robots: { index: false, follow: false },
};

export default async function PerfilPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/login?next=/perfil");

  const supabase = await createClient();

  // Quien todavía no está aprobado no tiene nada asignado ni ha subido nada,
  // así que se le ahorran las consultas.
  const [misFotos, misPistas, misTareas, misCompras] = sesion.esMiembro
    ? await Promise.all([
        supabase
          .from("media")
          .select("id, anio, tipo, url, thumb_url, descripcion")
          .eq("subido_por", sesion.userId)
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("pistas")
          .select("id, titulo, artista, tipo, origen")
          .eq("subido_por", sesion.userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("tareas_miembros")
          .select(
            "tareas(id, titulo, descripcion, fecha, hecha, documento_url, documento_nombre)",
          )
          .eq("perfil_id", sesion.userId),
        supabase
          .from("compra_miembros")
          .select("lista_compra(id, item, cantidad, comprado, anio)")
          .eq("perfil_id", sesion.userId),
      ])
    : [null, null, null, null];

  function aplanar<T>(filas: unknown[] | null | undefined, campo: string): T[] {
    return (filas ?? [])
      .map((f) => {
        const rel = (f as Record<string, unknown>)[campo];
        return (Array.isArray(rel) ? rel[0] : rel) as T | undefined;
      })
      .filter(Boolean) as T[];
  }

  const tareas = aplanar<MiTarea>(misTareas?.data, "tareas").sort((a, b) =>
    (a.fecha ?? "9999").localeCompare(b.fecha ?? "9999"),
  );
  const compras = aplanar<MiCompra>(misCompras?.data, "lista_compra");

  return (
    <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl space-y-10">
        <section>
          <h1 className="mb-5 text-2xl font-semibold sm:text-3xl">Mi perfil</h1>
          <EditarPerfil
            nombre={sesion.nombre}
            usuario={sesion.usuario}
            avatarUrl={sesion.avatarUrl}
          />
          <p className="mt-3 text-sm text-white/50">
            {sesion.esAdmin
              ? "Directiva de la peña"
              : sesion.esMiembro
                ? "Miembro de la peña"
                : "Cuenta pendiente de que la directiva la apruebe"}
          </p>
        </section>

        {sesion.esMiembro && (
          <>
            <section className="border-t border-white/10 pt-8">
              <MisPendientes tareas={tareas} compras={compras} />
            </section>

            <section className="border-t border-white/10 pt-8">
              <h2 className="text-lg font-semibold">Mis fotos y vídeos</h2>
              {!misFotos?.data?.length ? (
                <p className="mt-2 text-sm text-white/40">
                  Todavía no has subido nada a la galería.
                </p>
              ) : (
                <ul className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2">
                  {misFotos.data.map((m) => (
                    <li key={m.id}>
                      <Link
                        href={`/galeria/${m.anio}/${m.id}`}
                        className="group relative block aspect-square cursor-pointer overflow-hidden rounded-md bg-white/5"
                      >
                        <Image
                          src={m.thumb_url || m.url}
                          alt={m.descripcion || `Foto de ${m.anio}`}
                          fill
                          sizes="(max-width: 640px) 33vw, 25vw"
                          className="object-cover transition-opacity duration-200 group-hover:opacity-80"
                        />
                        {m.tipo === "video" && (
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
              <h2 className="text-lg font-semibold">Mi música</h2>
              {!misPistas?.data?.length ? (
                <p className="mt-2 text-sm text-white/40">
                  Todavía no has subido música.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {misPistas.data.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5"
                    >
                      <Music
                        size={16}
                        className="shrink-0 text-white/40"
                        aria-hidden="true"
                      />
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
              <Link
                href="/musica"
                className="mt-3 inline-block cursor-pointer text-sm text-white/50 underline hover:text-white"
              >
                Ir a Música
              </Link>
            </section>
          </>
        )}

        <section className="border-t border-white/10 pt-8">
          <h2 className="text-lg font-semibold">Ajustes</h2>

          <div className="mt-4">
            <p className="mb-1 text-sm text-white/70">Notificaciones</p>
            <p className="mb-2 text-xs text-white/40">
              Vienen activadas: te avisamos de fotos nuevas, música, tareas y
              mensajes del chat. Puedes apagarlas aquí cuando quieras.
            </p>
            <AvisosPush />
          </div>

          <form action={cerrarSesion} className="mt-8">
            <button
              type="submit"
              className="inline-flex min-h-[48px] cursor-pointer items-center gap-2 rounded-full border border-white/25 px-5 text-sm transition-colors duration-200 hover:bg-white/10"
            >
              <LogOut size={16} aria-hidden="true" />
              Cerrar sesión
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
