"use client";

import { Check } from "lucide-react";

export type MiembroSimple = {
  id: string;
  nombre: string | null;
  usuario: string | null;
};

/**
 * Lista de miembros con casillas para repartir una tarea o una compra entre
 * varias personas. No usa un `<select multiple>`, que en móvil es horrible.
 */
export default function SelectorMiembros({
  miembros,
  seleccionados,
  onCambio,
  etiqueta = "Quién se encarga",
}: {
  miembros: MiembroSimple[];
  seleccionados: string[];
  onCambio: (ids: string[]) => void;
  etiqueta?: string;
}) {
  function alternar(id: string) {
    onCambio(
      seleccionados.includes(id)
        ? seleccionados.filter((x) => x !== id)
        : [...seleccionados, id],
    );
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm text-white/70">{etiqueta}</legend>

      {miembros.length === 0 ? (
        <p className="text-xs text-white/40">
          Todavía no hay miembros aprobados a los que asignar.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {miembros.map((m) => {
            const activo = seleccionados.includes(m.id);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => alternar(m.id)}
                  aria-pressed={activo}
                  className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border px-4 text-sm transition-colors duration-200 ${
                    activo
                      ? "border-white bg-white text-black"
                      : "border-white/25 text-white/70 hover:bg-white/10"
                  }`}
                >
                  {activo && <Check size={14} aria-hidden="true" />}
                  {m.nombre || m.usuario || "Miembro"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
