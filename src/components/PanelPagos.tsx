"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import Avatar from "./Avatar";
import { marcarPago } from "@/app/actions/camisetas";

export type PagoMiembro = {
  id: string;
  nombre: string | null;
  usuario: string | null;
  avatarUrl: string | null;
  pagado: boolean;
};

/**
 * Quién ha pagado la cuota del año. Sin importes: solo sí o no, que es como
 * lo lleva la peña.
 *
 * Lo ve cualquier miembro (saber quién va al día es parte de organizarse),
 * pero la casilla solo la mueve la directiva o el tesorero, que son quienes
 * cobran. La base de datos lo vuelve a exigir por su cuenta.
 */
export default function PanelPagos({
  anio,
  miembros,
  puedeMarcar,
}: {
  anio: number;
  miembros: PagoMiembro[];
  puedeMarcar: boolean;
}) {
  const [estado, setEstado] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(miembros.map((m) => [m.id, m.pagado])),
  );
  const [, startTransition] = useTransition();

  function alternar(id: string) {
    if (!puedeMarcar) return;
    const nuevo = !estado[id];
    setEstado((prev) => ({ ...prev, [id]: nuevo }));
    startTransition(() => {
      void marcarPago(id, anio, nuevo).catch(() => undefined);
    });
  }

  const alDia = miembros.filter((m) => estado[m.id]).length;

  return (
    <div className="mt-6">
      <p className="text-sm text-white/50">
        {alDia} de {miembros.length} al día con la cuota de {anio}.
      </p>

      <ul className="mt-4 space-y-2">
        {miembros.map((m) => {
          const pagado = estado[m.id] ?? false;
          return (
            <li
              key={m.id}
              className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5"
            >
              <Avatar nombre={m.nombre} avatarUrl={m.avatarUrl} tamano={36} />

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {m.nombre || m.usuario || "Miembro"}
                </p>
                <p className="text-xs text-white/50">
                  {pagado ? "Pagado" : "Pendiente"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => alternar(m.id)}
                disabled={!puedeMarcar}
                aria-pressed={pagado}
                aria-label={
                  pagado
                    ? `Marcar a ${m.nombre ?? "este miembro"} como no pagado`
                    : `Marcar a ${m.nombre ?? "este miembro"} como pagado`
                }
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
                  pagado
                    ? "border-white bg-white text-black"
                    : "border-white/30 text-transparent"
                } ${puedeMarcar ? "cursor-pointer hover:border-white/60" : "cursor-default opacity-70"}`}
              >
                <Check size={18} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>

      {!puedeMarcar && (
        <p className="mt-4 text-xs text-white/40">
          Solo la directiva o el tesorero pueden marcar los pagos.
        </p>
      )}
    </div>
  );
}
