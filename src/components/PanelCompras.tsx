"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Check, Trash2, Plus, Users } from "lucide-react";
import {
  crearItemCompra,
  alternarComprado,
  borrarItemCompra,
} from "@/app/actions/gestion";
import { asignarCompra } from "@/app/actions/tareas";
import SelectorMiembros, { type MiembroSimple } from "./SelectorMiembros";

export type ItemCompra = {
  id: string;
  item: string;
  cantidad: number;
  comprado: boolean;
  anio: number;
  notas: string | null;
  asignados: MiembroSimple[];
};

const ANIOS = Array.from(
  { length: new Date().getFullYear() - 2010 + 1 },
  (_, i) => new Date().getFullYear() - i,
);

export default function PanelCompras({
  items,
  miembros,
}: {
  items: ItemCompra[];
  miembros: MiembroSimple[];
}) {
  const [estado, accion, pendiente] = useActionState(crearItemCompra, null);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  // Qué artículo tiene abierto el panel de reparto.
  const [repartiendo, setRepartiendo] = useState<string | null>(null);

  useEffect(() => {
    if (estado && !estado.error) formRef.current?.reset();
  }, [estado]);

  const porAnio = new Map<number, ItemCompra[]>();
  for (const i of items) {
    const lista = porAnio.get(i.anio) ?? [];
    lista.push(i);
    porAnio.set(i.anio, lista);
  }

  const pendientes = items.filter((i) => !i.comprado).length;

  return (
    <div className="mt-6">
      {items.length > 0 && (
        <p className="text-sm text-white/50">
          {pendientes === 0
            ? "Todo comprado."
            : `${pendientes} ${pendientes === 1 ? "cosa" : "cosas"} por comprar`}
        </p>
      )}

      <form
        ref={formRef}
        action={accion}
        className="mt-4 space-y-2 rounded-xl border border-white/15 p-4"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="itemC" className="sr-only">
              Qué hay que comprar
            </label>
            <input
              id="itemC"
              name="item"
              required
              placeholder="Qué hay que comprar"
              className="min-h-[48px] w-full rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
            />
          </div>
          <div className="w-full sm:w-24">
            <label htmlFor="cantidadC" className="sr-only">
              Cantidad
            </label>
            <input
              id="cantidadC"
              name="cantidad"
              type="number"
              min="1"
              inputMode="numeric"
              defaultValue={1}
              className="min-h-[48px] w-full rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
            />
          </div>
          <div className="w-full sm:w-28">
            <label htmlFor="anioC" className="sr-only">
              Año
            </label>
            <select
              id="anioC"
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
          {pendiente ? "Añadiendo…" : "Añadir a la lista"}
        </button>
      </form>

      {[...porAnio.entries()].map(([anio, lista]) => (
        <section key={anio} className="mt-8">
          <h2 className="mb-3 text-sm uppercase tracking-wider text-white/40 tabular-nums">
            {anio}
          </h2>
          <ul className="space-y-2">
            {lista.map((i) => (
              <li
                key={i.id}
                className="rounded-lg border border-white/10 px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label={
                      i.comprado
                        ? `Marcar ${i.item} como no comprado`
                        : `Marcar ${i.item} como comprado`
                    }
                    aria-pressed={i.comprado}
                    onClick={() =>
                      startTransition(() => {
                        void alternarComprado(i.id, !i.comprado);
                      })
                    }
                    className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors duration-200 ${
                      i.comprado
                        ? "border-white bg-white text-black"
                        : "border-white/30 text-transparent hover:border-white/60"
                    }`}
                  >
                    <Check size={18} aria-hidden="true" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate font-medium ${
                        i.comprado ? "text-white/40 line-through" : ""
                      }`}
                    >
                      {i.item}
                    </p>
                    <p className="truncate text-xs text-white/50">
                      {[
                        i.cantidad > 1 && `Cantidad: ${i.cantidad}`,
                        i.asignados.length
                          ? i.asignados
                              .map((a) => a.nombre || a.usuario)
                              .join(", ")
                          : "Sin asignar",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label={`Repartir ${i.item}`}
                    aria-expanded={repartiendo === i.id}
                    onClick={() =>
                      setRepartiendo(repartiendo === i.id ? null : i.id)
                    }
                    className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ${
                      repartiendo === i.id
                        ? "text-white"
                        : "text-white/30 hover:text-white"
                    }`}
                  >
                    <Users size={16} aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    aria-label={`Borrar ${i.item}`}
                    onClick={() =>
                      startTransition(() => {
                        void borrarItemCompra(i.id);
                      })
                    }
                    className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/30 transition-colors duration-200 hover:text-red-400"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>

                {repartiendo === i.id && (
                  <div className="mt-3 border-t border-white/10 pt-3">
                    <SelectorMiembros
                      etiqueta="Quién lo compra"
                      miembros={miembros}
                      seleccionados={i.asignados.map((a) => a.id)}
                      onCambio={(ids) =>
                        startTransition(() => {
                          void asignarCompra(i.id, ids);
                        })
                      }
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {items.length === 0 && (
        <p className="mt-6 text-sm text-white/40">La lista está vacía.</p>
      )}
    </div>
  );
}
