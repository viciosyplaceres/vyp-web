"use client";

import { useState } from "react";

export default function MapaDiferido({ src, title }: { src: string; title: string }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="relative h-[320px] overflow-hidden sm:h-[420px]">
      {abierto ? (
        <iframe
          src={src}
          title={title}
          className="absolute inset-x-0 top-0 h-[calc(100%+44px)] w-full border-0 grayscale invert"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.10),transparent_65%)] px-6 text-center transition-colors hover:bg-white/10"
        >
          <span className="text-sm font-medium">Ver mapa interactivo</span>
          <span className="max-w-sm text-xs text-white/60">
            OpenStreetMap se carga solo cuando lo abres.
          </span>
        </button>
      )}
    </div>
  );
}
