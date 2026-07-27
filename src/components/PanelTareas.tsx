"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Trash2, Plus, Paperclip } from "lucide-react";
import { diaLegible } from "@/lib/formato";
import type { MiembroSimple } from "./SelectorMiembros";
import FormularioTarea, { claveDia } from "./tareas/FormularioTarea";
import CalendarioAgosto from "./tareas/CalendarioAgosto";
import type { TareaListada } from "./tareas/tipos";
import { marcarTarea, borrarTarea } from "@/app/actions/tareas";

export type { TareaListada } from "./tareas/tipos";

export default function PanelTareas({
  anio,
  tareas,
  miembros,
}: {
  anio: number;
  tareas: TareaListada[];
  miembros: MiembroSimple[];
}) {
  const [pendiente, startTransition] = useTransition();
  const [diaActivo, setDiaActivo] = useState<number | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);

  const porDia = useMemo(() => {
    const mapa = new Map<string, TareaListada[]>();
    for (const t of tareas) {
      const clave = t.fecha ?? "sin-fecha";
      mapa.set(clave, [...(mapa.get(clave) ?? []), t]);
    }
    return mapa;
  }, [tareas]);

  const visibles = useMemo(() => {
    if (diaActivo === null) return tareas;
    return porDia.get(claveDia(anio, diaActivo)) ?? [];
  }, [diaActivo, porDia, tareas, anio]);

  const sinFecha = porDia.get("sin-fecha") ?? [];
  const hechas = tareas.filter((t) => t.hecha).length;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Tareas de agosto {anio}</h2>
          {tareas.length > 0 && (
            <p className="text-sm text-white/50">
              {hechas} de {tareas.length} hechas
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setMostrarForm((v) => !v)}
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-black transition-opacity duration-200 hover:opacity-85"
        >
          <Plus size={16} aria-hidden="true" />
          Nueva tarea
        </button>
      </div>

      {mostrarForm && (
        <FormularioTarea
          anio={anio}
          miembros={miembros}
          onCreada={() => setMostrarForm(false)}
        />
      )}

      <CalendarioAgosto
        anio={anio}
        porDia={porDia}
        diaActivo={diaActivo}
        onElegirDia={setDiaActivo}
      />

      {/* Lista de tareas */}
      <ul className="mt-6 space-y-2">
        {visibles.length === 0 && (
          <li className="text-sm text-white/40">
            {diaActivo !== null
              ? `No hay tareas para el ${diaActivo} de agosto.`
              : "Todavía no hay tareas."}
          </li>
        )}

        {visibles.map((t) => (
          <li
            key={t.id}
            className="flex items-start gap-3 rounded-lg border border-white/10 px-3 py-3"
          >
            <button
              type="button"
              aria-label={t.hecha ? `Marcar ${t.titulo} pendiente` : `Marcar ${t.titulo} hecha`}
              aria-pressed={t.hecha}
              disabled={pendiente}
              onClick={() =>
                startTransition(() => {
                  void marcarTarea(t.id, !t.hecha);
                })
              }
              className={`mt-0.5 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors duration-200 ${
                t.hecha
                  ? "border-white bg-white text-black"
                  : "border-white/30 text-transparent hover:border-white/60"
              }`}
            >
              <Check size={16} aria-hidden="true" />
            </button>

            <div className="min-w-0 flex-1">
              <p className={`font-medium ${t.hecha ? "text-white/40 line-through" : ""}`}>
                {t.titulo}
              </p>
              {t.descripcion && (
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-white/60">
                  {t.descripcion}
                </p>
              )}

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/50">
                {t.fecha && <span className="tabular-nums">{diaLegible(t.fecha)}</span>}
                {t.asignados.length > 0 && (
                  <span>{t.asignados.map((a) => a.nombre || a.usuario).join(", ")}</span>
                )}
                {t.documento_url && (
                  <a
                    href={`/api/r2/documento?clave=${encodeURIComponent(t.documento_url)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex cursor-pointer items-center gap-1 underline hover:text-white"
                  >
                    <Paperclip size={12} aria-hidden="true" />
                    {t.documento_nombre ?? "Documento"}
                  </a>
                )}
              </div>
            </div>

            <button
              type="button"
              aria-label={`Borrar ${t.titulo}`}
              disabled={pendiente}
              onClick={() =>
                startTransition(() => {
                  void borrarTarea(t.id);
                })
              }
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/30 transition-colors duration-200 hover:text-red-400"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      {diaActivo === null && sinFecha.length > 0 && (
        <p className="mt-4 text-xs text-white/40">
          {sinFecha.length}{" "}
          {sinFecha.length === 1 ? "tarea sin día" : "tareas sin día"} concreto.
        </p>
      )}
    </div>
  );
}
