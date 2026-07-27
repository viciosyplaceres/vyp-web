import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";

export type FotoCarrusel = {
  id: string;
  anio: number;
  tipo: "foto" | "video";
  url: string;
  thumb_url: string | null;
  descripcion: string | null;
};

/**
 * Cinta horizontal en bucle infinito, sin JavaScript: la lista se duplica una
 * vez y una animación CSS mueve el conjunto exactamente la mitad de su ancho,
 * así el final del primer bloque enlaza sin costura con el principio del
 * segundo. Se detiene sola si el usuario tiene activado "reducir movimiento"
 * (regla global en globals.css).
 */
export default function CarruselFotos({ fotos }: { fotos: FotoCarrusel[] }) {
  if (fotos.length === 0) return null;

  const dobles = [...fotos, ...fotos];

  return (
    <div className="group/carrusel overflow-hidden">
      <ul
        className="flex w-max animate-[carrusel_36s_linear_infinite] gap-2 group-hover/carrusel:[animation-play-state:paused] sm:gap-3"
        style={{ ["--n" as string]: fotos.length }}
      >
        {dobles.map((f, i) => (
          <li key={`${f.id}-${i}`} className="w-28 shrink-0 sm:w-36">
            <Link
              href={`/galeria/${f.anio}/${f.id}`}
              className="group relative block aspect-square cursor-pointer overflow-hidden rounded-lg bg-white/5"
              tabIndex={i < fotos.length ? 0 : -1}
              aria-hidden={i >= fotos.length}
            >
              <Image
                src={f.thumb_url || f.url}
                alt={f.descripcion || `Foto de las fiestas de ${f.anio}`}
                fill
                sizes="144px"
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
    </div>
  );
}
