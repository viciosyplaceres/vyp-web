"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, Loader2 } from "lucide-react";
import { actualizarAnioActivo } from "@/app/actions/configuracion";

/**
 * Se fija una vez (normalmente al empezar a preparar las fiestas siguientes)
 * y a partir de ahí Tareas, Participantes y la Compra lo usan por defecto,
 * sin volver a preguntar cada vez que se entra a gestionar algo.
 */
export default function SelectorAnioActivo({ anioActivo }: { anioActivo: number }) {
  const [anio, setAnio] = useState(anioActivo);
  const [pendiente, startTransition] = useTransition();
  const actual = new Date().getFullYear();
  const primero = Math.min(actual - 1, anioActivo);
  const ultimo = Math.max(actual + 10, anioActivo);
  const anios = Array.from({ length: ultimo - primero + 1 }, (_, i) => primero + i);

  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3">
      <CalendarCheck size={18} className="shrink-0 text-white/60" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Año de gestión</p>
        <p className="text-xs text-white/50">
          Tareas, camisetas, pagos y compra se gestionan para este año.
        </p>
      </div>
      <select
        aria-label="Año de gestión"
        value={anio}
        onChange={(e) => {
          const nuevo = Number(e.target.value);
          setAnio(nuevo);
          startTransition(() => {
            void actualizarAnioActivo(nuevo);
          });
        }}
        disabled={pendiente}
        className="min-h-[44px] cursor-pointer rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white disabled:opacity-50"
      >
        {anios.map((a) => (
          <option key={a} value={a} className="bg-black">
            {a}
          </option>
        ))}
      </select>
      {pendiente && (
        <Loader2 size={16} className="shrink-0 animate-spin text-white/40" aria-hidden="true" />
      )}
    </div>
  );
}
