"use client";

import { useState } from "react";
import { Paperclip, Loader2 } from "lucide-react";
import SelectorMiembros, { type MiembroSimple } from "../SelectorMiembros";
import { crearTarea } from "@/app/actions/tareas";

/** Las fiestas son siempre en agosto: 31 días, del 1 al 31. */
export const MES = 8;
export const DIAS_AGOSTO = 31;

export function claveDia(anio: number, dia: number) {
  return `${anio}-${String(MES).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** El formulario de tarea nueva, con su subida de documento a R2. */
export default function FormularioTarea({
  anio,
  miembros,
  onCreada,
}: {
  anio: number;
  miembros: MiembroSimple[];
  onCreada: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState("");
  const [asignados, setAsignados] = useState<string[]>([]);
  const [documento, setDocumento] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      onCreada();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear.");
    } finally {
      setGuardando(false);
    }
  }

  return (
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
            <option key={d} value={claveDia(anio, d)} className="bg-black">
              {d} de agosto de {anio}
            </option>
          ))}
        </select>
      </div>

      <SelectorMiembros miembros={miembros} seleccionados={asignados} onCambio={setAsignados} />

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
  );
}
