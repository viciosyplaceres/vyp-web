"use client";

import { useEffect } from "react";
import Image from "next/image";
import { X } from "lucide-react";

/**
 * Ver una imagen a pantalla completa, con fondo oscuro y botón de cerrar.
 * Pensado para miniaturas pequeñas (camisetas, avatares…) donde hace falta
 * ver el detalle real de la foto.
 */
export default function VisorImagen({
  src,
  alt,
  onCerrar,
}: {
  src: string;
  alt: string;
  onCerrar: () => void;
}) {
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alPulsar);
    // Evita que la lista de detrás se desplace mientras el visor está abierto.
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", alPulsar);
      document.body.style.overflow = "";
    };
  }, [onCerrar]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onCerrar}
    >
      {/* z-10: sin esto, el contenedor de la imagen (que en móvil ocupa
          también la esquina superior derecha) se pinta por encima al venir
          después en el DOM, y el botón de cerrar deja de recibir el clic. */}
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar"
        className="absolute right-4 top-4 z-10 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-150 hover:bg-white/20"
        style={{ top: "calc(1rem + env(safe-area-inset-top))" }}
      >
        <X size={22} aria-hidden="true" />
      </button>

      <div className="relative h-full w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes="100vw"
          className="object-contain"
          priority
        />
      </div>
    </div>
  );
}
