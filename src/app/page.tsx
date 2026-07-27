import Image from "next/image";
import Link from "next/link";
import { Images, Music, MapPin, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const sesion = await getSesion();

  const { data: ultimas } = await supabase
    .from("media")
    .select("id, anio, tipo, url, thumb_url, descripcion")
    .order("created_at", { ascending: false })
    .limit(6);

  return (
    <main className="flex-1">
      {/* Portada */}
      <section className="px-4 pt-10 pb-12 sm:px-6 sm:pt-16">
        <div className="mx-auto max-w-5xl">
          <p className="mb-4 text-xs uppercase tracking-[0.35em] text-white/50">
            Fuente Álamo &middot; Murcia
          </p>
          <Image
            src="/logo/vyp-wordmark.png"
            alt="Vicios & Placeres"
            width={2000}
            height={647}
            priority
            className="h-auto w-full max-w-md"
          />
          <p className="mt-5 max-w-prose text-base leading-relaxed text-white/60 sm:text-lg">
            Peña de las fiestas de Fuente Álamo de Murcia. Diez días al año, y
            aquí queda todo: las fotos, los vídeos, la música y lo que hay que
            organizar.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/galeria"
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-black transition-opacity duration-200 hover:opacity-85"
            >
              <Images size={18} aria-hidden="true" />
              Ver la galería
            </Link>
            <Link
              href="/musica"
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-white/25 px-5 text-sm font-medium transition-colors duration-200 hover:bg-white/10"
            >
              <Music size={18} aria-hidden="true" />
              Escuchar música
            </Link>
          </div>
        </div>
      </section>

      {/* Últimas subidas */}
      {ultimas && ultimas.length > 0 && (
        <section className="px-4 pb-12 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-semibold sm:text-xl">Lo último</h2>
              <Link
                href="/galeria"
                className="inline-flex cursor-pointer items-center gap-1 text-sm text-white/50 transition-colors duration-200 hover:text-white"
              >
                Toda la galería
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>

            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
              {ultimas.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/galeria/${m.anio}/${m.id}`}
                    className="group block cursor-pointer overflow-hidden rounded-lg bg-white/5"
                  >
                    <div className="relative aspect-square">
                      <Image
                        src={m.thumb_url || m.url}
                        alt={m.descripcion || `Foto de las fiestas de ${m.anio}`}
                        fill
                        sizes="(max-width: 640px) 50vw, 33vw"
                        className="object-cover transition-opacity duration-200 group-hover:opacity-85"
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Dónde estamos */}
      <section className="px-4 pb-14 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/donde"
            className="flex cursor-pointer items-center gap-4 rounded-xl border border-white/15 p-5 transition-colors duration-200 hover:bg-white/5"
          >
            <MapPin
              size={22}
              className="shrink-0 text-white/60"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium">Dónde está la peña</p>
              <p className="truncate text-sm text-white/50">
                C. Asturias, Fuente Álamo de Murcia
              </p>
            </div>
            <ArrowRight
              size={18}
              className="shrink-0 text-white/40"
              aria-hidden="true"
            />
          </Link>

          {!sesion?.esMiembro && (
            <p className="mt-6 text-sm text-white/50">
              ¿Eres de la peña?{" "}
              <Link
                href="/registro"
                className="cursor-pointer underline hover:text-white"
              >
                Regístrate
              </Link>{" "}
              para subir fotos, música y entrar en el chat.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
