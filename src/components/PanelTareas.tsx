"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Check,
  Trash2,
  Plus,
  Paperclip,
  CalendarDays,
  Loader2,
  X,
} from "lucide-react";
import SelectorMiembros, { type MiembroSimple } from "./SelectorMiembros";
import {
  crearTarea,
  marcarTarea,
  borrarTarea,
} from "@/app/actions/tareas";

export type TareaListada = {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha: string | null;
  hecha: boolean;
  documento_url: string | null;
  documento_nombre: string | null;
  asignados: MiembroSimple[];
};

/** Agosto de 2026: las fiestas del pueblo. 31 días, del 1 al 31. */
const ANIO = 2026;
const MES = 8;
const DIAS_AGOSTO = 31;

function claveDia(dia: number) {
  return `${ANIO}-${String(MES).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Lunes = 0. Se usa para cuadrar la primera fila del calendario. */
function diaSemana(dia: number) {
  return (new Date(ANIO, MES - 1, dia).getDay() + 6) % 7;
}

const NOMBRES_DIA = ["L", "M", "X", "J", "V", "S", "D"];

export default function PanelTareas({
  tareas,
  miembros,
}: {
  tareas: TareaListada[];
  miembros: MiembroSimple[];
}) {
  const [pendiente, startTransition] = useTransition();
  const [diaActivo, setDiaActivo] = useState<number | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);

  // --- formulario de tarea nueva ---
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState("");
  const [asignados, setAsignados] = useState<string[]>([]);
  const [documento, setDocumento] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    return porDia.get(claveDia(diaActivo)) ?? [];
  }, [diaActivo, porDia, tareas]);

  const sinFecha = porDia.get("sin-fecha") ?? [];
  const hechas = tareas.filter((t) => t.hecha).length;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;

    setError(null);
    setGuardando(true);
    try {
      let documentoClave: string | null = null;
      let documentoNombre: string | null = null;

      if (documento) {
        const res = await fetch("/api/r2/subir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: documento.name,
            contentType: documento.type,
            tamano: documento.size,
            destino: "documento",
          }),
        });
        if (!res.ok) {
          const cuerpo = await res.json().catch(() => ({}));
          throw new Error(cuerpo.error ?? "No se pudo preparar el documento.");
        }
        const { url, clave } = await res.json();

        const subida = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": documento.type },
          body: documento,
        });
        if (!subida.ok) throw new Error("Falló la subida del documento.");

        documentoClave = clave;
        documentoNombre = documento.name;
      }

      await crearTarea({
        titulo,
        descripcion,
        fecha: fecha || null,
        asignados,
        documentoClave,
        documentoNombre,
      });

      setTitulo("");
      setDescripcion("");
      setFecha("");
      setAsignados([]);
      setDocumento(null);
      setMostrarForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Tareas de agosto 2026</h2>
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
        <form
          onSubmit={enviar}
          className="mt-4 space-y-4 rounded-xl border border-white/15 bg-white/5 p-4"
        >
          <div className="space-y-1.5">
            <label htmlFor="tituloTarea" className="text-sm text-white/70">
              Nombre de la tarea
            </label>
            <input
              id="tituloTarea"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              maxLength={200}
              className="min-h-[48px] w-full rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="descTarea" className="text-sm text-white/70">
              Descripción
            </label>
            <textarea
              id="descTarea"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-base outline-none focus:border-white"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="fechaTarea" className="text-sm text-white/70">
              Día de agosto (opcional)
            </label>
            <select
              id="fechaTarea"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="min-h-[48px] w-full cursor-pointer rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
            >
              <option value="" className="bg-black">
                Sin día concreto
              </option>
              {Array.from({ length: DIAS_AGOSTO }, (_, i) => i + 1).map((d) => (
                <option key={d} value={claveDia(d)} className="bg-black">
                  {d} de agosto de {ANIO}
                </option>
              ))}
            </select>
          </div>

          <SelectorMiembros
            miembros={miembros}
            seleccionados={asignados}
            onCambio={setAsignados}
          />

          <div className="space-y-1.5">
            <label className="flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 text-sm transition-colors duration-200 hover:border-white/40">
              <Paperclip size={16} aria-hidden="true" />
              {documento ? documento.name : "Adjuntar documento (opcional)"}
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,image/*"
                className="sr-only"
                onChange={(e) => setDocumento(e.target.files?.[0] ?? null)}
              />
            </label>
            {documento && (
              <button
                type="button"
                onClick={() => setDocumento(null)}
                className="cursor-pointer text-xs text-white/40 hover:text-white"
              >
                Quitar documento
              </button>
            )}
            <p className="text-xs text-white/40">
              PDF, imagen, Word, Excel o texto. Hasta 20 MB.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={guardando || !titulo.trim()}
            className="inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-6 font-medium text-black transition-opacity duration-200 hover:opacity-85 disabled:opacity-40"
          >
            {guardando && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {guardando ? "Guardando…" : "Crear tarea"}
          </button>
        </form>
      )}

      {/* Calendario de agosto: cada día enseña cuántas tareas tiene */}
      <div className="mt-8">
        <div className="mb-2 flex items-center gap-2 text-sm text-white/50">
          <CalendarDays size={16} aria-hidden="true" />
          Agosto {ANIO}
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {NOMBRES_DIA.map((d) => (
            <div key={d} className="py-1 text-[11px] text-white/30">
              {d}
            </div>
          ))}

          {Array.from({ length: diaSemana(1) }, (_, i) => (
            <div key={`hueco-${i}`} />
          ))}

          {Array.from({ length: DIAS_AGOSTO }, (_, i) => i + 1).map((d) => {
            const delDia = porDia.get(claveDia(d)) ?? [];
            const activo = diaActivo === d;
            const todasHechas =
              delDia.length > 0 && delDia.every((t) => t.hecha);

            return (
              <button
                key={d}
                type="button"
                onClick={() => setDiaActivo(activo ? null : d)}
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
                      activo
                        ? "bg-black"
                        : todasHechas
                          ? "bg-white/40"
                          : "bg-white"
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
            onClick={() => setDiaActivo(null)}
            className="mt-3 inline-flex cursor-pointer items-center gap-1 text-sm text-white/50 hover:text-white"
          >
            <X size={14} aria-hidden="true" />
            Ver todas las tareas
          </button>
        )}
      </div>

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
                {t.fecha && (
                  <span className="tabular-nums">
                    {Number(t.fecha.slice(8, 10))} de agosto
                  </span>
                )}
                {t.asignados.length > 0 && (
                  <span>
                    {t.asignados.map((a) => a.nombre || a.usuario).join(", ")}
                  </span>
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
