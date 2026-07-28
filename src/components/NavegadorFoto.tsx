"use client";

import { useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

const UMBRAL_DESLIZAMIENTO = 50;

type Props = {
  src: string;
  alt: string;
  ancho: number;
  alto: number;
  anterior: string | null;
  siguiente: string | null;
};

/** Foto de detalle con navegación entre las fotos del mismo año. */
export default function NavegadorFoto({
  src,
  alt,
  ancho,
  alto,
  anterior,
  siguiente,
}: Props) {
  const router = useRouter();
  const inicioX = useRef<number | null>(null);

  const navegar = useCallback((destino: string | null) => {
    if (destino) router.push(destino);
  }, [router]);

  useEffect(() => {
    const alPulsar = (event: KeyboardEvent) => {
      const elemento = event.target;
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        (elemento instanceof Element &&
          elemento.closest("input, textarea, select, [contenteditable], [role='slider']"))
      ) {
        return;
      }

      const destino =
        event.key === "ArrowLeft"
          ? anterior
          : event.key === "ArrowRight"
            ? siguiente
            : null;
      if (destino) {
        event.preventDefault();
        navegar(destino);
      }
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [anterior, siguiente, navegar]);

  return (
    <div
      className="relative touch-pan-y"
      onPointerDown={(event) => {
        inicioX.current = event.pointerType === "touch" ? event.clientX : null;
      }}
      onPointerUp={(event) => {
        if (inicioX.current === null) return;
        const desplazamiento = event.clientX - inicioX.current;
        inicioX.current = null;
        if (Math.abs(desplazamiento) < UMBRAL_DESLIZAMIENTO) return;
        navegar(desplazamiento > 0 ? anterior : siguiente);
      }}
      onPointerCancel={() => {
        inicioX.current = null;
      }}
    >
      <Image
        src={src}
        alt={alt}
        width={ancho}
        height={alto}
        sizes="(max-width: 768px) 100vw, 768px"
        className="h-auto w-full select-none"
        priority
      />

      {anterior && (
        <button
          type="button"
          onClick={() => navegar(anterior)}
          aria-label="Foto anterior"
          className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/65 text-white shadow-lg transition-colors duration-200 hover:bg-black/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:flex"
        >
          <ChevronLeft size={26} aria-hidden="true" />
        </button>
      )}

      {siguiente && (
        <button
          type="button"
          onClick={() => navegar(siguiente)}
          aria-label="Foto siguiente"
          className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/65 text-white shadow-lg transition-colors duration-200 hover:bg-black/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:flex"
        >
          <ChevronRight size={26} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
