"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";

/**
 * Botón grande arriba de la página que despliega el formulario de subida
 * justo debajo. Empieza cerrado para no ensuciar la vista a quien solo entra
 * a mirar fotos o escuchar música.
 *
 * ⚠ SOLO puede usarse desde otro componente de cliente (ver
 * `PanelSubirGaleria` y `PanelSubirMusica`). Recibe el icono —que es un
 * componente— y los hijos como función, y ninguna de las dos cosas se puede
 * enviar desde un Server Component: React no sabe serializar funciones y la
 * página revienta con un 500 en producción. Ya pasó una vez.
 */
export default function PanelSubir({
  etiqueta,
  Icono,
  children,
}: {
  etiqueta: string;
  Icono: LucideIcon;
  children: (cerrar: () => void) => React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-black transition-opacity duration-200 hover:opacity-85 sm:w-auto"
      >
        <Icono size={18} aria-hidden="true" />
        {etiqueta}
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`transition-transform duration-200 ${abierto ? "rotate-180" : ""}`}
        />
      </button>

      {abierto && (
        <div className="mt-4 rounded-xl border border-white/15 bg-white/5 p-4 sm:p-5">
          {children(() => setAbierto(false))}
        </div>
      )}
    </div>
  );
}
