"use client";

import { CalendarDays, X } from "lucide-react";
import { claveDia, DIAS_AGOSTO, MES } from "./FormularioTarea";
import type { TareaListada } from "./tipos";

/** Lunes = 0. Se usa para cuadrar la primera fila del calendario. */
function diaSemana(anio: number, dia: number) {
  return (new Date(anio, MES - 1, dia).getDay() + 6) % 7;
}

const NOMBRES_DIA = ["L", "M", "X", "J", "V", "S", "D"];

/** Calendario de agosto: cada día enseña cuántas tareas tiene. */
export default function CalendarioAgosto({
  anio,
  porDia,
  diaActivo,
  onElegirDia,
}: {
  anio: number;
  porDia: Map<string, TareaListada[]>;
  diaActivo: number | null;
  onElegirDia: (dia: number | null) => void;
}) {
  return (
    <div className="mt-8">
      <div className="mb-2 flex items-center gap-2 text-sm text-white/50">
        <CalendarDays size={16} aria-hidden="true" />
        Agosto {anio}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {NOMBRES_DIA.map((d) => (
          <div key={d} className="py-1 text-[11px] text-white/30">
            {d}
          </div>
        ))}

        {Array.from({ length: diaSemana(anio, 1) }, (_, i) => (
          <div key={`hueco-${i}`} />
        ))}

        {Array.from({ length: DIAS_AGOSTO }, (_, i) => i + 1).map((d) => {
          const delDia = porDia.get(claveDia(anio, d)) ?? [];
          const activo = diaActivo === d;
          const todasHechas = delDia.length > 0 && delDia.every((t) => t.hecha);

          return (
            <button
              key={d}
              type="button"
              onClick={() => onElegirDia(activo ? null : d)}
              aria-pressed={activo}
              className={`flex min-h-[48px] cursor-pointer flex-col items-center justify-center rounded-lg border text-sm transition-colors duration-200 ${
                activo
                  ? "border-white bg-white text-black"
                  : delDia.length
                    ? "border-white/30 bg-white/10 hover:border-white/60"
                    : "border-white/10 text-white/40 hover:border-white/25"
              }`}
            >
              <span className="tabular-nums">{d}</span>
              {delDia.length > 0 && (
                <span
                  className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                    activo ? "bg-black" : todasHechas ? "bg-white/40" : "bg-white"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {diaActivo !== null && (
        <button
          type="button"
          onClick={() => onElegirDia(null)}
          className="mt-3 inline-flex cursor-pointer items-center gap-1 text-sm text-white/50 hover:text-white"
        >
          <X size={14} aria-hidden="true" />
          Ver todas las tareas
        </button>
      )}
    </div>
  );
}
