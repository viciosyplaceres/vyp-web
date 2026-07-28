import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import {
  Images,
  Music,
  MapPin,
  ArrowRight,
  Navigation,
  Upload,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSesion } from "@/lib/auth";
import { autorDe } from "@/lib/relaciones";
import CarruselFotos, { type FotoCarrusel } from "@/components/CarruselFotos";
import MusicaCompacta from "@/components/MusicaCompacta";
import type { PistaListada } from "@/components/ListaMusica";
import {
  obtenerUbicacion,
  type UbicacionPublica,
} from "@/app/actions/configuracion";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// El embed de Google Maps sin clave de API ("output=embed") ya no se puede
// incrustar: su respuesta llega con "X-Frame-Options: SAMEORIGIN" y el
// navegador la bloquea en cualquier dominio que no sea google.com. OpenStreetMap
// no impone esa restricción y no pide clave, así que es el que se ve de verdad.
const DELTA_LON = 0.004;
const DELTA_LAT = 0.003;

async function cargarEstadisticas() {
  const supabase = await createClient();
  return Promise.all([
    supabase.from("media").select("id", { count: "exact", head: true }),
    supabase
      .from("media")
      .select("anio")
      .order("anio", { ascending: true })
      .limit(1),
    createAdminClient()
      .from("perfiles")
      .select("id", { count: "exact", head: true })
      .eq("aprobado", true),
  ]);
}

async function cargarContenido() {
  const supabase = await createClient();
  const [{ data: ultimasFotos }, { data: ultimasPistas }, sesion] =
    await Promise.all([
      supabase
        .from("media")
        .select(
          "id, anio, tipo, url, thumb_url, descripcion, autores(nombre, avatar_url)",
        )
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("pistas")
        .select(
          "id, titulo, artista, tipo, anio, origen, url, embed_url, duracion_s, subido_por, autores(nombre, avatar_url)",
        )
        .order("created_at", { ascending: false })
        .limit(5),
      getSesion(),
    ]);

  return { ultimasFotos, ultimasPistas, sesion };
}

async function NombreUbicacion({
  ubicacion,
}: {
  ubicacion: Promise<UbicacionPublica>;
}) {
  return (await ubicacion).nombre;
}

async function Estadisticas({
  datos,
}: {
  datos: ReturnType<typeof cargarEstadisticas>;
}) {
  const [{ count: totalFotos }, { data: filaPrimerAnio }, { count: miembros }] =
    await datos;

  const primerAnio = filaPrimerAnio?.[0]?.anio ?? null;
  const anioActual = new Date().getFullYear();
  const anioFiestas = primerAnio ? anioActual - primerAnio + 1 : null;

  const stats = [
    anioFiestas && { valor: `${anioFiestas}`, etiqueta: "años de fiestas" },
    totalFotos ? { valor: `${totalFotos}+`, etiqueta: "fotos y vídeos" } : null,
    miembros ? { valor: `${miembros}`, etiqueta: "miembros" } : null,
  ].filter(Boolean) as { valor: string; etiqueta: string }[];

  if (stats.length === 0) return null;

  return (
    <dl className="mt-12 grid min-h-[77px] max-w-lg grid-cols-3 gap-4 border-t border-white/10 pt-8">
      {stats.map((stat) => (
        <div key={stat.etiqueta} className="flex flex-col">
          <dt className="order-2 mt-0.5 text-xs text-white/60 sm:text-sm">
            {stat.etiqueta}
          </dt>
          <dd className="order-1 text-3xl font-semibold tabular-nums sm:text-4xl">
            {stat.valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}

async function GaleriaHome({
  datos,
}: {
  datos: ReturnType<typeof cargarContenido>;
}) {
  const { ultimasFotos } = await datos;

  return (
    <>
      {/* Carrusel de la galería */}
      {ultimasFotos && ultimasFotos.length > 0 && (
        <section className="pb-14">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-semibold sm:text-xl">Galería</h2>
              <Link
                href="/galeria"
                className="inline-flex cursor-pointer items-center gap-1 text-sm text-white/50 transition-colors duration-200 hover:text-white"
              >
                Ver todas
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Sin el max-w del contenedor: la cinta puede sangrar hasta el borde. */}
          <div className="px-4 sm:px-6">
            <CarruselFotos
              fotos={ultimasFotos.map((foto) => {
                const autor = autorDe(foto.autores);
                return {
                  ...foto,
                  autorNombre: autor.nombre,
                  autorAvatar: autor.avatarUrl,
                } as FotoCarrusel;
              })}
            />
          </div>
        </section>
      )}
    </>
  );
}

async function MusicaHome({
  datos,
}: {
  datos: ReturnType<typeof cargarContenido>;
}) {
  const { ultimasPistas } = await datos;

  return (
    <>

      {/* Música */}
      {ultimasPistas && ultimasPistas.length > 0 && (
        <section className="px-4 pb-14 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-semibold sm:text-xl">Música</h2>
              <Link
                href="/musica"
                className="inline-flex cursor-pointer items-center gap-1 text-sm text-white/50 transition-colors duration-200 hover:text-white"
              >
                Ver todas
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>

            <MusicaCompacta
              pistas={ultimasPistas.map((pista) => {
                const autor = autorDe(pista.autores);
                return {
                  ...pista,
                  subidoPorId: pista.subido_por,
                  subidoPorNombre: autor.nombre,
                  subidoPorAvatar: autor.avatarUrl,
                } as PistaListada;
              })}
            />
          </div>
        </section>
      )}
    </>
  );
}

async function UbicacionHome({
  ubicacion: ubicacionPromise,
}: {
  ubicacion: Promise<UbicacionPublica>;
}) {
  const ubicacion = await ubicacionPromise;
  const bbox = [
    ubicacion.longitud - DELTA_LON,
    ubicacion.latitud - DELTA_LAT,
    ubicacion.longitud + DELTA_LON,
    ubicacion.latitud + DELTA_LAT,
  ].join(",");
  const mapaEmbed = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&marker=${ubicacion.latitud}%2C${ubicacion.longitud}&layer=mapnik`;

  return (
    <>

      {/* Dónde estamos */}
      <section id="donde" className="scroll-mt-16 px-4 pb-14 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-lg font-semibold sm:text-xl">Dónde estamos</h2>

          <div className="mt-4 flex items-start gap-3 text-white/70">
            <MapPin size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>
              {ubicacion.direccion}
              <br />
              <span className="text-sm text-white/60 tabular-nums">
                {ubicacion.latitud}, {ubicacion.longitud}
              </span>
            </p>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-white/15 bg-white/5">
            <div className="relative h-[320px] overflow-hidden sm:h-[420px]">
              <iframe
                src={mapaEmbed}
                title={`Mapa de la peña en ${ubicacion.direccion}`}
                loading="lazy"
                className="absolute inset-x-0 top-0 h-[calc(100%+44px)] w-full border-0 grayscale invert"
              />
            </div>
            <p className="border-t border-white/10 px-3 py-2 text-[11px] text-white/60">
              ©{" "}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer underline transition-colors hover:text-white"
              >
                Colaboradores de OpenStreetMap
              </a>
            </p>
          </div>

          <a
            href={ubicacion.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-6 font-medium text-black transition-opacity duration-200 hover:opacity-85 sm:w-auto"
          >
            <Navigation size={18} aria-hidden="true" />
            Cómo llegar
          </a>

          <p className="mt-3 text-sm text-white/60">
            El botón abre la ruta en Google Maps. En el móvil se abre directamente
            la app.
          </p>
        </div>
      </section>
    </>
  );
}

async function InvitacionHome({
  datos,
}: {
  datos: ReturnType<typeof cargarContenido>;
}) {
  const { sesion } = await datos;

  return (
    <>

      {/* Invitación a unirse */}
      {!sesion?.esMiembro && (
        <section className="px-4 pb-16 sm:px-6">
          <div className="mx-auto max-w-5xl rounded-2xl border border-white/15 bg-white/5 p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-white/60">
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
    </>
  );
}

function ContenidoHome({
  datos,
  ubicacion,
}: {
  datos: ReturnType<typeof cargarContenido>;
  ubicacion: Promise<UbicacionPublica>;
}) {
  return (
    <>
      <Suspense fallback={null}>
        <GaleriaHome datos={datos} />
      </Suspense>
      <Suspense fallback={null}>
        <MusicaHome datos={datos} />
      </Suspense>
      <Suspense fallback={null}>
        <UbicacionHome ubicacion={ubicacion} />
      </Suspense>
      <Suspense fallback={null}>
        <InvitacionHome datos={datos} />
      </Suspense>
    </>
  );
}

export default function Home() {
  const ubicacion = obtenerUbicacion();
  const estadisticas = cargarEstadisticas();
  const contenido = cargarContenido();

  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-14 pb-16 sm:px-6 sm:pt-20 sm:pb-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-32 h-96 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.08),transparent_70%)]"
        />

        <div className="relative mx-auto max-w-5xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-[0.25em] text-white/60">
            <Suspense fallback="Fuente Álamo · Murcia">
              <NombreUbicacion ubicacion={ubicacion} />
            </Suspense>
          </p>

          <h1>
            <Image
              src="/logo/vyp-wordmark.png"
              alt="Vicios & Placeres"
              width={1886}
              height={182}
              priority
              sizes="(min-width: 640px) 497px, calc(100vw - 32px)"
              className="h-auto w-full max-w-[414px] sm:max-w-[497px]"
            />
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/60 sm:text-xl">
            La peña de las fiestas. Durante esos días se vive; aquí queda todo
            el resto: las fotos, los vídeos, la música y lo que hay que organizar
            entre todos.
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
            <Link
              href="#donde"
              className="inline-flex min-h-[48px] cursor-pointer items-center gap-2 rounded-full border border-white/25 px-6 text-sm font-medium transition-colors duration-200 hover:bg-white/10"
            >
              <Navigation size={18} aria-hidden="true" />
              Cómo llegar
            </Link>
          </div>

          <Suspense
            fallback={
              <div
                aria-hidden="true"
                className="mt-12 min-h-[77px] max-w-lg border-t border-white/10 pt-8"
              />
            }
          >
            <Estadisticas datos={estadisticas} />
          </Suspense>
        </div>
      </section>

      <ContenidoHome datos={contenido} ubicacion={ubicacion} />

    </main>
  );
}
