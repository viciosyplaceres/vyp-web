"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { Check, Trash2, Plus } from "lucide-react";
import {
  crearParticipante,
  alternarPago,
  borrarParticipante,
} from "@/app/actions/gestion";

export type Participante = {
  id: string;
  nombre: string;
  pagado: boolean;
  importe: number | null;
  talla_camiseta: string | null;
  notas: string | null;
  anio: number;
};

const ANIOS = Array.from(
  { length: new Date().getFullYear() - 2010 + 1 },
  (_, i) => new Date().getFullYear() - i,
);

export default function PanelParticipantes({
  participantes,
}: {
  participantes: Participante[];
}) {
  const [estado, accion, pendiente] = useActionState(crearParticipante, null);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado && !estado.error) formRef.current?.reset();
  }, [estado]);

  const pagados = participantes.filter((p) => p.pagado).length;
  const recaudado = participantes
    .filter((p) => p.pagado)
    .reduce((suma, p) => suma + Number(p.importe ?? 0), 0);

  // Agrupado por año: las fiestas son anuales, y así no se mezclan listas.
  const porAnio = new Map<number, Participante[]>();
  for (const p of participantes) {
    const lista = porAnio.get(p.anio) ?? [];
    lista.push(p);
    porAnio.set(p.anio, lista);
  }

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold">Participantes</h2>
      {participantes.length > 0 && (
        <p className="mt-1 text-sm text-white/50">
          {pagados} de {participantes.length} han pagado
          {recaudado > 0 && ` · ${recaudado.toFixed(2)} € recaudados`}
        </p>
      )}

      <form
        ref={formRef}
        action={accion}
        className="mt-4 space-y-2 rounded-xl border border-white/15 p-4"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="nombreP" className="sr-only">
              Nombre
            </label>
            <input
              id="nombreP"
              name="nombre"
              required
              placeholder="Nombre"
              className="min-h-[48px] w-full rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
            />
          </div>
          <div className="w-full sm:w-28">
            <label htmlFor="anioP" className="sr-only">
              Año
            </label>
            <select
              id="anioP"
              name="anio"
              defaultValue={ANIOS[0]}
              className="min-h-[48px] w-full cursor-pointer rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
            >
              {ANIOS.map((a) => (
                <option key={a} value={a} className="bg-black">
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="tallaP" className="sr-only">
              Talla de camiseta
            </label>
            <input
              id="tallaP"
              name="talla"
              placeholder="Talla (S, M, L…)"
              className="min-h-[48px] w-full rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="importeP" className="sr-only">
              Importe en euros
            </label>
            <input
              id="importeP"
              name="importe"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="Importe (€)"
              className="min-h-[48px] w-full rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
            />
          </div>
        </div>

        {estado?.error && (
          <p role="alert" className="text-sm text-red-400">
            {estado.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pendiente}
          className="inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-5 font-medium text-black transition-opacity duration-200 hover:opacity-85 disabled:opacity-50"
        >
          <Plus size={18} aria-hidden="true" />
          {pendiente ? "Añadiendo…" : "Añadir participante"}
        </button>
      </form>

      {[...porAnio.entries()].map(([anio, lista]) => (
        <section key={anio} className="mt-8">
          <h3 className="mb-3 text-sm uppercase tracking-wider text-white/40 tabular-nums">
            {anio}
          </h3>
          <ul className="space-y-2">
            {lista.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5"
              >
                <button
                  type="button"
                  aria-label={
                    p.pagado
                      ? `Marcar a ${p.nombre} como no pagado`
                      : `Marcar a ${p.nombre} como pagado`
                  }
                  aria-pressed={p.pagado}
                  onClick={() =>
                    startTransition(() => {
                      void alternarPago(p.id, !p.pagado);
                    })
                  }
                  className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors duration-200 ${
                    p.pagado
                      ? "border-white bg-white text-black"
                      : "border-white/30 text-transparent hover:border-white/60"
                  }`}
                >
                  <Check size={18} aria-hidden="true" />
                </button>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.nombre}</p>
                  <p className="truncate text-xs text-white/50">
                    {[
                      p.pagado ? "Pagado" : "Pendiente",
                      p.talla_camiseta && `Talla ${p.talla_camiseta}`,
                      p.importe != null && `${Number(p.importe).toFixed(2)} €`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>

                <button
                  type="button"
                  aria-label={`Borrar a ${p.nombre}`}
                  onClick={() =>
                    startTransition(() => {
                      void borrarParticipante(p.id);
                    })
                  }
                  className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/30 transition-colors duration-200 hover:text-red-400"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {participantes.length === 0 && (
        <p className="mt-6 text-sm text-white/40">
          Todavía no hay participantes apuntados.
        </p>
      )}
    </div>
  );
}
