"use client";

import { useState, useTransition } from "react";
import { CalendarRange, Loader2 } from "lucide-react";
import {
  actualizarFechasFiestas,
  type FechasFiestas,
} from "@/app/actions/configuracion";

/**
 * Las fechas de las fiestas del año activo, para que la limpieza (y lo que
 * dependa de ellas más adelante) no dependa de un rango escrito a mano en el
 * código. Se fijan una vez al año desde aquí; el año que viene solo hace
 * falta cambiar las fechas, no tocar nada más.
 */
export default function SelectorFechasFiestas({
  anio,
  fechas,
}: {
  anio: number;
  fechas: FechasFiestas | null;
}) {
  const [inicio, setInicio] = useState(fechas?.inicio ?? "");
  const [fin, setFin] = useState(fechas?.fin ?? "");
  const [plazasLimpieza, setPlazasLimpieza] = useState(fechas?.plazasLimpieza ?? 2);
  const [plazasDesmontaje, setPlazasDesmontaje] = useState(fechas?.plazasDesmontaje ?? 3);
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  function guardar(
    nuevoInicio: string,
    nuevoFin: string,
    nuevasPlazasLimpieza: number,
    nuevasPlazasDesmontaje: number,
  ) {
    if (!nuevoInicio || !nuevoFin) return;
    setError(null);
    setGuardado(false);
    startTransition(async () => {
      try {
        await actualizarFechasFiestas(
          anio,
          nuevoInicio,
          nuevoFin,
          nuevasPlazasLimpieza,
          nuevasPlazasDesmontaje,
        );
        setGuardado(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudieron guardar las fechas.");
      }
    });
  }

  return (
    <div className="mb-6 rounded-xl border border-white/15 bg-white/5 px-4 py-3">
      <div className="flex items-center gap-3">
        <CalendarRange size={18} className="shrink-0 text-white/60" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Fechas de las fiestas de {anio}</p>
          <p className="text-xs text-white/50">
            De aquí sale el calendario de la limpieza. Se cambian una vez al año.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="flex-1 min-w-[140px]">
          <span className="sr-only">Primer día</span>
          <input
            type="date"
            value={inicio}
            onChange={(e) => {
              setInicio(e.target.value);
              guardar(e.target.value, fin, plazasLimpieza, plazasDesmontaje);
            }}
            className="min-h-[44px] w-full cursor-pointer rounded-lg border border-white/20 bg-white/5 px-3 text-sm text-white outline-none focus:border-white [color-scheme:dark]"
          />
        </label>
        <span className="text-white/40">a</span>
        <label className="flex-1 min-w-[140px]">
          <span className="sr-only">Último día</span>
          <input
            type="date"
            value={fin}
            onChange={(e) => {
              setFin(e.target.value);
              guardar(inicio, e.target.value, plazasLimpieza, plazasDesmontaje);
            }}
            className="min-h-[44px] w-full cursor-pointer rounded-lg border border-white/20 bg-white/5 px-3 text-sm text-white outline-none focus:border-white [color-scheme:dark]"
          />
        </label>
        {pendiente && (
          <Loader2 size={16} className="shrink-0 animate-spin text-white/40" aria-hidden="true" />
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="space-y-1.5">
          <span className="text-xs text-white/50">Personas por día</span>
          <input
            type="number"
            min="1"
            max="20"
            value={plazasLimpieza}
            onChange={(e) => setPlazasLimpieza(Number(e.target.value))}
            onBlur={() => guardar(inicio, fin, plazasLimpieza, plazasDesmontaje)}
            className="min-h-[44px] w-full rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs text-white/50">Personas para desmontar</span>
          <input
            type="number"
            min="1"
            max="20"
            value={plazasDesmontaje}
            onChange={(e) => setPlazasDesmontaje(Number(e.target.value))}
            onBlur={() => guardar(inicio, fin, plazasLimpieza, plazasDesmontaje)}
            className="min-h-[44px] w-full rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
          />
        </label>
      </div>

      <p className="mt-2 text-xs text-white/40">
        El último día es el de <strong>limpieza y desmontaje</strong>; los demás usan las plazas
        normales.
      </p>

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}
      {guardado && !error && !pendiente && (
        <p className="mt-2 text-xs text-white/50">Guardado.</p>
      )}
    </div>
  );
}
