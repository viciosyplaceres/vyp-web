"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { guardarParticipante, type DatosParticipante } from "@/app/actions/gestion";

export type FichaParticipante = {
  perfilId: string;
  nombre: string | null;
  talla: string | null;
  pagado: boolean;
  importe: number | null;
};

const PRIMER_ANIO = 2026;
const ULTIMO_ANIO = 2040;
const ANIOS = Array.from(
  { length: ULTIMO_ANIO - PRIMER_ANIO + 1 },
  (_, i) => PRIMER_ANIO + i,
);

/**
 * Una fila por miembro aprobado, no una lista que hay que rellenar a mano.
 * Cada cambio (talla, pago, importe) se guarda solo, con upsert sobre
 * (perfil_id, año) — no hace falta "crear" ni "borrar" a nadie.
 */
function FilaParticipante({
  anio,
  ficha,
}: {
  anio: number;
  ficha: FichaParticipante;
}) {
  const [talla, setTalla] = useState(ficha.talla ?? "");
  const [pagado, setPagado] = useState(ficha.pagado);
  const [importe, setImporte] = useState(
    ficha.importe != null ? String(ficha.importe) : "",
  );
  const [pendiente, startTransition] = useTransition();

  function guardar(datos: Partial<DatosParticipante>) {
    const siguiente: DatosParticipante = {
      talla: datos.talla !== undefined ? datos.talla : talla || null,
      pagado: datos.pagado !== undefined ? datos.pagado : pagado,
      importe:
        datos.importe !== undefined
          ? datos.importe
          : importe
            ? Number(importe)
            : null,
    };
    startTransition(() => {
      void guardarParticipante(
        ficha.perfilId,
        anio,
        siguiente,
        ficha.nombre ?? "Un miembro",
      );
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5">
      <button
        type="button"
        aria-label={
          pagado
            ? `Marcar a ${ficha.nombre} como no pagado`
            : `Marcar a ${ficha.nombre} como pagado`
        }
        aria-pressed={pagado}
        onClick={() => {
          const nuevo = !pagado;
          setPagado(nuevo);
          guardar({ pagado: nuevo });
        }}
        className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors duration-200 ${
          pagado
            ? "border-white bg-white text-black"
            : "border-white/30 text-transparent hover:border-white/60"
        }`}
      >
        <Check size={18} aria-hidden="true" />
      </button>

      <p className="min-w-0 flex-1 basis-32 truncate font-medium">
        {ficha.nombre ?? "Miembro"}
      </p>

      <input
        value={talla}
        onChange={(e) => setTalla(e.target.value)}
        onBlur={() => guardar({ talla: talla || null })}
        placeholder="Talla"
        className="min-h-[40px] w-20 rounded-lg border border-white/20 bg-white/5 px-2 text-center text-sm outline-none focus:border-white"
      />

      <div className="flex items-center gap-1">
        <input
          value={importe}
          onChange={(e) => setImporte(e.target.value)}
          onBlur={() =>
            guardar({ importe: importe ? Number(importe) : null })
          }
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          placeholder="€"
          className="min-h-[40px] w-20 rounded-lg border border-white/20 bg-white/5 px-2 text-center text-sm outline-none focus:border-white"
        />
        {pendiente && (
          <Loader2 size={14} className="animate-spin text-white/30" aria-hidden="true" />
        )}
      </div>
    </li>
  );
}

export default function PanelParticipantes({
  anio,
  fichas,
}: {
  anio: number;
  fichas: FichaParticipante[];
}) {
  const router = useRouter();

  const pagados = fichas.filter((f) => f.pagado).length;
  const recaudado = fichas
    .filter((f) => f.pagado)
    .reduce((suma, f) => suma + Number(f.importe ?? 0), 0);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Participantes</h2>
          {fichas.length > 0 && (
            <p className="text-sm text-white/50">
              {pagados} de {fichas.length} han pagado
              {recaudado > 0 && ` · ${recaudado.toFixed(2)} € recaudados`}
            </p>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-white/70">
          Año
          <select
            value={anio}
            onChange={(e) =>
              router.push(`/admin/participantes?anio=${e.target.value}`)
            }
            className="min-h-[44px] cursor-pointer rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
          >
            {ANIOS.map((a) => (
              <option key={a} value={a} className="bg-black">
                {a}
              </option>
            ))}
          </select>
        </label>
      </div>

      {fichas.length === 0 ? (
        <p className="mt-6 text-sm text-white/40">
          Todavía no hay miembros aprobados.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {fichas.map((f) => (
            <FilaParticipante key={f.perfilId} anio={anio} ficha={f} />
          ))}
        </ul>
      )}
    </div>
  );
}
