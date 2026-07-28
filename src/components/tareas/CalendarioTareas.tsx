"use client";

import { CalendarDays, X } from "lucide-react";
import { diaLegible } from "@/lib/formato";
import type { TareaListada } from "./tipos";

const DIA_SEMANA = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  timeZone: "UTC",
});

export default function CalendarioTareas({
  dias,
  porDia,
  diaActivo,
  onElegirDia,
}: {
  dias: string[];
  porDia: Map<string, TareaListada[]>;
  diaActivo: string | null;
  onElegirDia: (dia: string | null) => void;
}) {
  if (dias.length === 0) {
    return (
      <p className="mt-6 rounded-lg border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-sm text-amber-200/70">
        La directiva todavía no ha configurado las fechas de las fiestas de este año.
      </p>
    );
  }

  return (
    <div className="mt-8">
      <div className="mb-2 flex items-center gap-2 text-sm text-white/50">
        <CalendarDays size={16} aria-hidden="true" />
        Calendario de las fiestas
      </div>

      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
        {dias.map((dia) => {
          const delDia = porDia.get(dia) ?? [];
          const activo = diaActivo === dia;
          const todasHechas = delDia.length > 0 && delDia.every((tarea) => tarea.hecha);
          const fecha = new Date(`${dia}T00:00:00Z`);

          return (
            <button
              key={dia}
              type="button"
              onClick={() => onElegirDia(activo ? null : dia)}
              aria-label={diaLegible(dia) ?? dia}
              aria-pressed={activo}
              className={`flex min-h-[58px] cursor-pointer flex-col items-center justify-center rounded-lg border px-1 text-sm transition-colors duration-200 ${
                activo
                  ? "border-white bg-white text-black"
                  : delDia.length
                    ? "border-white/30 bg-white/10 hover:border-white/60"
                    : "border-white/10 text-white/50 hover:border-white/25"
              }`}
            >
              <span className="text-[10px] uppercase opacity-60">
                {DIA_SEMANA.format(fecha).replace(".", "")}
              </span>
              <span className="tabular-nums">{fecha.getUTCDate()}</span>
              <span className="text-[10px] lowercase opacity-60">
                {fecha.toLocaleDateString("es-ES", { month: "short", timeZone: "UTC" }).replace(".", "")}
              </span>
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

      {diaActivo && (
        <button
          type="button"
          onClick={() => onElegirDia(null)}
          className="mt-3 inline-flex min-h-[44px] cursor-pointer items-center gap-1 text-sm text-white/50 hover:text-white"
        >
          <X size={14} aria-hidden="true" />
          Ver todas las tareas
        </button>
      )}
    </div>
  );
}
