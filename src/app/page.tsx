import Image from "next/image";
import Link from "next/link";
import {
  Images,
  Music,
  MapPin,
  ArrowRight,
  MessageCircle,
  Upload,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";

export const dynamic = "force-dynamic";

const PILARES = [
  {
    href: "/galeria",
    Icono: Images,
    titulo: "Galería",
    texto: "Fotos y vídeos de cada año de fiestas, organizados por año.",
  },
  {
    href: "/musica",
    Icono: Music,
    titulo: "Música",
    texto: "Sesiones y canciones que no se cortan al cambiar de página.",
  },
  {
    href: "/chat",
    Icono: MessageCircle,
    titulo: "Chat",
    texto: "El grupo de la peña, en vivo, solo para miembros.",
  },
];

export default async function Home() {
  const supabase = await createClient();
  const sesion = await getSesion();

  const [{ data: ultimas }, { data: mediaAnios }, { count: miembros }] =
    await Promise.all([
      supabase
        .from("media")
        .select("id, anio, tipo, url, thumb_url, descripcion")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase.from("media").select("anio"),
      supabase
        .from("perfiles")
        .select("id", { count: "exact", head: true })
        .eq("aprobado", true),
    ]);

  const totalFotos = mediaAnios?.length ?? 0;
  const anios = new Set((mediaAnios ?? []).map((m) => m.anio));
  const primerAnio = anios.size ? Math.min(...anios) : 2010;
  const anioActual = new Date().getFullYear();
  const anioFiestas = anios.size ? anioActual - primerAnio + 1 : null;

  const stats = [
    anioFiestas && { valor: `${anioFiestas}`, etiqueta: "años de fiestas" },
    totalFotos > 0 && { valor: `${totalFotos}+`, etiqueta: "fotos y vídeos" },
    miembros ? { valor: `${miembros}`, etiqueta: "miembros" } : null,
  ].filter(Boolean) as { valor: string; etiqueta: string }[];

  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-14 pb-16 sm:px-6 sm:pt-20 sm:pb-20">
        {/* Halo decorativo, muy sutil, para que la portada no sea un plano
            de negro sólido sin dar ningún color de más. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-32 h-96 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.08),transparent_70%)]"
        />

        <div className="relative mx-auto max-w-5xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-[0.25em] text-white/60">
            Fuente Álamo &middot; Murcia
          </p>

          <Image
            src="/logo/vyp-wordmark.png"
            alt="Vicios & Placeres"
            width={1886}
            height={182}
            priority
            className="h-auto w-full max-w-sm sm:max-w-lg"
          />

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/60 sm:text-xl">
            La peña de las fiestas. Diez días al año, y aquí queda todo el
            resto: las fotos, los vídeos, la música y lo que hay que
            organizar entre todos.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/galeria"
              className="inline-flex min-h-[48px] cursor-pointer items-center gap-2 rounded-full bg-white px-6 text-sm font-medium text-black transition-opacity duration-200 hover:opacity-85"
            >
              <Images size={18} aria-hidden="true" />
              Ver la galería
            </Link>
            <Link
              href="/musica"
              className="inline-flex min-h-[48px] cursor-pointer items-center gap-2 rounded-full border border-white/25 px-6 text-sm font-medium transition-colors duration-200 hover:bg-white/10"
            >
              <Music size={18} aria-hidden="true" />
              Escuchar música
            </Link>
          </div>

          {stats.length > 0 && (
            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-4 border-t border-white/10 pt-8">
              {stats.map((s) => (
                <div key={s.etiqueta}>
                  <dt className="sr-only">{s.etiqueta}</dt>
                  <dd className="text-3xl font-semibold tabular-nums sm:text-4xl">
                    {s.valor}
                  </dd>
                  <p className="mt-0.5 text-xs text-white/50 sm:text-sm">
                    {s.etiqueta}
                  </p>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      {/* Los tres pilares */}
      <section className="px-4 pb-14 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <ul className="grid gap-3 sm:grid-cols-3">
            {PILARES.map(({ href, Icono, titulo, texto }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="group flex h-full cursor-pointer flex-col gap-3 rounded-xl border border-white/12 p-5 transition-colors duration-200 hover:border-white/30 hover:bg-white/5"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-200 group-hover:bg-white group-hover:text-black">
                    <Icono size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-medium">{titulo}</p>
                    <p className="mt-1 text-sm text-white/50">{texto}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Últimas subidas */}
      {ultimas && ultimas.length > 0 && (
        <section className="px-4 pb-14 sm:px-6">
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
            className="flex cursor-pointer items-center gap-4 rounded-xl border border-white/15 p-5 transition-colors duration-200 hover:border-white/30 hover:bg-white/5"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10">
              <MapPin size={20} className="text-white/70" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">Dónde está la peña</p>
              <p className="truncate text-sm text-white/50">
                C. Asturias, Fuente Álamo de Murcia · cómo llegar
              </p>
            </div>
            <ArrowRight
              size={18}
              className="shrink-0 text-white/40"
              aria-hidden="true"
            />
          </Link>
        </div>
      </section>

      {/* Invitación a unirse */}
      {!sesion?.esMiembro && (
        <section className="px-4 pb-16 sm:px-6">
          <div className="mx-auto max-w-5xl rounded-2xl border border-white/15 bg-white/5 p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-white/40">
                  <ShieldCheck size={14} aria-hidden="true" />
                  Solo para la peña
                </p>
                <h2 className="mt-2 text-xl font-semibold sm:text-2xl">
                  ¿Eres de la peña? Únete
                </h2>
                <p className="mt-1 max-w-md text-sm text-white/60">
                  Regístrate para subir fotos y música, comentar y entrar en el
                  chat. La directiva aprueba tu cuenta y listo.
                </p>
              </div>
              <Link
                href="/registro"
                className="inline-flex min-h-[48px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-medium text-black transition-opacity duration-200 hover:opacity-85"
              >
                <Upload size={18} aria-hidden="true" />
                Registrarme
              </Link>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
