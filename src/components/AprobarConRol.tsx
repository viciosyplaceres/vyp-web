"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { aprobarMiembro } from "@/app/actions/miembros";

const OPCIONES = [
  { valor: "miembro", texto: "Miembro" },
  { valor: "tesorero", texto: "Tesorero" },
  { valor: "admin", texto: "Directiva" },
] as const;

/**
 * Aprobar eligiendo de una vez el rol con el que entra. Solo se enseña a
 * quien puede repartir roles (`puedeAsignarRoles`); el resto de la directiva
 * ve el botón sencillo de siempre y aprueba como miembro normal.
 */
export default function AprobarConRol({ id }: { id: string }) {
  const [rol, setRol] = useState<(typeof OPCIONES)[number]["valor"]>("miembro");
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function aprobar() {
    setError(null);
    startTransition(async () => {
      try {
        await aprobarMiembro(id, rol);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo aprobar.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <select
        value={rol}
        onChange={(e) => setRol(e.target.value as (typeof OPCIONES)[number]["valor"])}
        aria-label="Rol con el que aprobar"
        className="min-h-[36px] cursor-pointer rounded-lg border border-white/20 bg-white/5 px-2 text-xs text-white outline-none focus:border-white"
      >
        {OPCIONES.map((o) => (
          <option key={o.valor} value={o.valor} className="bg-black">
            {o.texto}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={aprobar}
        disabled={pendiente}
        className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-black transition-opacity duration-200 hover:opacity-85 disabled:opacity-50"
      >
        {pendiente && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
        Aprobar
      </button>
      {error && <p className="max-w-[180px] text-right text-xs text-red-400">{error}</p>}
    </div>
  );
}
