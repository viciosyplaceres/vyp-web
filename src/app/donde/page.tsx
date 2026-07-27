import type { Metadata } from "next";
import { MapPin, Navigation } from "lucide-react";

export const metadata: Metadata = {
  title: "Dónde estamos",
  description:
    "La peña Vicios & Placeres está en C. Asturias, Fuente Álamo de Murcia. Cómo llegar.",
};

const LAT = 37.717352;
const LON = -1.17391;
const DIRECCION = "C. Asturias, 30320 Fuente Álamo, Murcia";
const COMO_LLEGAR = `https://www.google.com/maps/dir/?api=1&destination=${LAT},${LON}`;
const MAPA_EMBED = `https://www.google.com/maps?q=${LAT},${LON}&hl=es&z=17&output=embed`;

export default function DondePage() {
  return (
    <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold sm:text-3xl">Dónde estamos</h1>

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

        {/* El mapa entero es pulsable, no solo el botón */}
        <a
          href={COMO_LLEGAR}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Abrir la ubicación de la peña en Google Maps"
          className="mt-5 block cursor-pointer overflow-hidden rounded-xl border border-white/15 transition-colors duration-200 hover:border-white/35"
        >
          <iframe
            src={MAPA_EMBED}
            title={`Mapa de la peña en ${DIRECCION}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="pointer-events-none h-[320px] w-full border-0 sm:h-[420px]"
          />
        </a>

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
          En el móvil se abre directamente la app de Google Maps con la ruta
          puesta.
        </p>
      </div>
    </main>
  );
}
