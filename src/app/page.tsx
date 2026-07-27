import Link from "next/link";
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

export const dynamic = "force-dynamic";

const LAT = 37.717352;
const LON = -1.17391;
const DIRECCION = "C. Asturias, 30320 Fuente Álamo, Murcia";
const COMO_LLEGAR = `https://www.google.com/maps/dir/?api=1&destination=${LAT},${LON}`;

// El embed de Google Maps sin clave de API ("output=embed") ya no se puede
// incrustar: su respuesta llega con "X-Frame-Options: SAMEORIGIN" y el
// navegador la bloquea en cualquier dominio que no sea google.com. OpenStreetMap
// no impone esa restricción y no pide clave, así que es el que se ve de verdad.
const DELTA_LON = 0.004;
const DELTA_LAT = 0.003;
const BBOX = [LON - DELTA_LON, LAT - DELTA_LAT, LON + DELTA_LON, LAT + DELTA_LAT].join(",");
const MAPA_EMBED = `https://www.openstreetmap.org/export/embed.html?bbox=${BBOX}&marker=${LAT}%2C${LON}&layer=mapnik`;

export default async function Home() {
  const supabase = await createClient();
  const sesion = await getSesion();

  const [
    { data: ultimasFotos },
    { data: ultimasPistas },
    { count: totalFotos },
    { data: filaPrimerAnio },
    { count: miembros },
  ] = await Promise.all([
    supabase
      .from("media")
      .select(
        "id, anio, tipo, url, thumb_url, descripcion, autores(nombre, avatar_url)",
      )
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("pistas")
      .select(
        "id, titulo, artista, tipo, anio, origen, url, embed_url, duracion_s, subido_por, autores(nombre, avatar_url)",
      )
      .order("created_at", { ascending: false })
      .limit(5),
    // Las dos cifras de la portada (cuántas fotos hay y desde qué año) se
    // sacan con un contador y con una sola fila. Antes se traía la columna
    // `anio` de la tabla ENTERA para contar el largo del array y buscarle el
    // mínimo en memoria: con 20 fotos apenas se nota, pero crece para siempre
    // —cada verano de la peña suma— y la portada es justo la página que más
    // gente abre.
    supabase.from("media").select("id", { count: "exact", head: true }),
    supabase
      .from("media")
      .select("anio")
      .order("anio", { ascending: true })
      .limit(1),
    // `perfiles` no es legible para `anon` (correcto: es donde vive el rol
    // de cada uno), así que un visitante sin sesión nunca podría contar
    // cuántos miembros hay. Es solo un número agregado, nada sensible, así
    // que aquí se cuenta con el cliente de servicio en vez de dejar la
    // estadística rota para todo el mundo salvo la directiva.
    createAdminClient()
      .from("perfiles")
      .select("id", { count: "exact", head: true })
      .eq("aprobado", true),
  ]);

  const primerAnio = filaPrimerAnio?.[0]?.anio ?? null;
  const anioActual = new Date().getFullYear();
  const anioFiestas = primerAnio ? anioActual - primerAnio + 1 : null;

  const stats = [
    anioFiestas && { valor: `${anioFiestas}`, etiqueta: "años de fiestas" },
    totalFotos ? { valor: `${totalFotos}+`, etiqueta: "fotos y vídeos" } : null,
    miembros ? { valor: `${miembros}`, etiqueta: "miembros" } : null,
  ].filter(Boolean) as { valor: string; etiqueta: string }[];

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
            Fuente Álamo &middot; Murcia
          </p>

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
            <Link
              href="#donde"
              className="inline-flex min-h-[48px] cursor-pointer items-center gap-2 rounded-full border border-white/25 px-6 text-sm font-medium transition-colors duration-200 hover:bg-white/10"
            >
              <Navigation size={18} aria-hidden="true" />
              Cómo llegar
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
              fotos={ultimasFotos.map((f) => {
                const autor = autorDe(f.autores);
                return {
                  ...f,
                  autorNombre: autor.nombre,
                  autorAvatar: autor.avatarUrl,
                } as FotoCarrusel;
              })}
            />
          </div>
        </section>
      )}

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
              pistas={ultimasPistas.map((p) => {
                const autor = autorDe(p.autores);
                return {
                  ...p,
                  subidoPorId: p.subido_por,
                  subidoPorNombre: autor.nombre,
                  subidoPorAvatar: autor.avatarUrl,
                } as PistaListada;
              })}
            />
          </div>
        </section>
      )}

      {/* Dónde estamos */}
      <section id="donde" className="scroll-mt-16 px-4 pb-14 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-lg font-semibold sm:text-xl">Dónde estamos</h2>

          <div className="mt-4 flex items-start gap-3 text-white/70">
            <MapPin size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>
              {DIRECCION}
              <br />
              <span className="text-sm text-white/40 tabular-nums">
                37°43&apos;02.5&quot;N 1°10&apos;26.1&quot;W
              </span>
            </p>
          </div>

          {/* Mapa real e interactivo, teñido en blanco y negro para encajar
              con el resto de la web. */}
          <div className="mt-5 overflow-hidden rounded-xl border border-white/15 bg-white/5">
            <iframe
              src={MAPA_EMBED}
              title={`Mapa de la peña en ${DIRECCION}`}
              loading="lazy"
              className="h-[320px] w-full border-0 grayscale invert sm:h-[420px]"
            />
          </div>

          <a
            href={COMO_LLEGAR}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-6 font-medium text-black transition-opacity duration-200 hover:opacity-85 sm:w-auto"
          >
            <Navigation size={18} aria-hidden="true" />
            Cómo llegar
          </a>

          <p className="mt-3 text-sm text-white/40">
            El botón abre la ruta en Google Maps. En el móvil se abre
            directamente la app.
          </p>
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
