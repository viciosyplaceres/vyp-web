"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { Check, Trash2, Plus, ArrowRight } from "lucide-react";
import {
  crearDeuda,
  marcarDeuda,
  borrarDeuda,
} from "@/app/actions/gestion";

export type MiembroSimple = { id: string; nombre: string | null };

export type DeudaListada = {
  id: string;
  deudor_id: string | null;
  acreedor_id: string | null;
  cantidad: number;
  descripcion: string | null;
  pagada: boolean;
  created_at: string;
};

/** `null` es "VYP" (la peña), la opción extra del desplegable. */
function nombreDe(id: string | null, miembros: MiembroSimple[]) {
  if (id === null) return "VYP";
  return miembros.find((m) => m.id === id)?.nombre ?? "Miembro";
}

export default function PanelDeudas({
  deudas,
  miembros,
}: {
  deudas: DeudaListada[];
  miembros: MiembroSimple[];
}) {
  const [estado, accion, pendiente] = useActionState(crearDeuda, null);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado && !estado.error) formRef.current?.reset();
  }, [estado]);

  const pendientes = deudas.filter((d) => !d.pagada);
  const totalPendiente = pendientes.reduce((s, d) => s + Number(d.cantidad), 0);

  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold">Deudas</h2>
      {deudas.length > 0 && (
        <p className="mt-1 text-sm text-white/50">
          {pendientes.length} pendientes
          {totalPendiente > 0 && ` · ${totalPendiente.toFixed(2)} € sin saldar`}
        </p>
      )}

      <form
        ref={formRef}
        action={accion}
        className="mt-4 space-y-3 rounded-xl border border-white/15 p-4"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="deudorD" className="text-sm text-white/70">
              Quién debe
            </label>
            <select
              id="deudorD"
              name="deudor"
              defaultValue=""
              className="min-h-[48px] w-full cursor-pointer rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
            >
              <option value="" className="bg-black">
                VYP (la peña)
              </option>
              {miembros.map((m) => (
                <option key={m.id} value={m.id} className="bg-black">
                  {m.nombre ?? "Miembro"}
                </option>
              ))}
            </select>
          </div>

          <ArrowRight
            size={18}
            className="mt-6 hidden shrink-0 text-white/30 sm:block"
            aria-hidden="true"
          />

          <div className="flex-1 space-y-1.5">
            <label htmlFor="acreedorD" className="text-sm text-white/70">
              A quién
            </label>
            <select
              id="acreedorD"
              name="acreedor"
              defaultValue=""
              className="min-h-[48px] w-full cursor-pointer rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
            >
              <option value="" className="bg-black">
                VYP (la peña)
              </option>
              {miembros.map((m) => (
                <option key={m.id} value={m.id} className="bg-black">
                  {m.nombre ?? "Miembro"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="w-full sm:w-32">
            <label htmlFor="cantidadD" className="sr-only">
              Cantidad en euros
            </label>
            <input
              id="cantidadD"
              name="cantidad"
              type="number"
              step="0.01"
              min="0.01"
              required
              inputMode="decimal"
              placeholder="Cantidad (€)"
              className="min-h-[48px] w-full rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="descripcionD" className="sr-only">
              Concepto
            </label>
            <input
              id="descripcionD"
              name="descripcion"
              placeholder="Concepto (opcional)"
              maxLength={200}
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
          {pendiente ? "Añadiendo…" : "Apuntar deuda"}
        </button>
      </form>

      <ul className="mt-6 space-y-2">
        {deudas.length === 0 && (
          <li className="text-sm text-white/40">No hay deudas apuntadas.</li>
        )}

        {deudas.map((d) => (
          <li
            key={d.id}
            className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5"
          >
            <button
              type="button"
              aria-label={
                d.pagada ? "Marcar como no saldada" : "Marcar como saldada"
              }
              aria-pressed={d.pagada}
              onClick={() =>
                startTransition(() => {
                  void marcarDeuda(d.id, !d.pagada);
                })
              }
              className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors duration-200 ${
                d.pagada
                  ? "border-white bg-white text-black"
                  : "border-white/30 text-transparent hover:border-white/60"
              }`}
            >
              <Check size={18} aria-hidden="true" />
            </button>

            <div className="min-w-0 flex-1">
              <p
                className={`truncate font-medium ${d.pagada ? "text-white/40 line-through" : ""}`}
              >
                {nombreDe(d.deudor_id, miembros)} → {nombreDe(d.acreedor_id, miembros)}
              </p>
              <p className="truncate text-xs text-white/50">
                {[
                  `${Number(d.cantidad).toFixed(2)} €`,
                  d.descripcion,
                  d.pagada ? "Saldada" : "Pendiente",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>

            <button
              type="button"
              aria-label="Borrar deuda"
              onClick={() =>
                startTransition(() => {
                  void borrarDeuda(d.id);
                })
              }
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/30 transition-colors duration-200 hover:text-red-400"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
