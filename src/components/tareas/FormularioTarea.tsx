"use client";

import { useState } from "react";
import { Paperclip, Loader2, X } from "lucide-react";
import SelectorMiembros, { type MiembroSimple } from "../SelectorMiembros";
import { crearTarea, editarTarea } from "@/app/actions/tareas";
import type { TareaListada } from "./tipos";

/** Las fiestas son siempre en agosto: 31 días, del 1 al 31. */
export const MES = 8;
export const DIAS_AGOSTO = 31;

export function claveDia(anio: number, dia: number) {
  return `${anio}-${String(MES).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * El formulario de tarea, con su subida de documento a R2. Sirve tanto para
 * crear una nueva como para editar una existente: pasando `tareaExistente`
 * llega precargado (título, descripción, día, encargados y documento) y
 * guarda con `editarTarea` en vez de `crearTarea`.
 *
 * Hacía falta de verdad: antes solo se podía repartir una tarea en el
 * momento de crearla. Si se te olvidaba marcar a alguien —fácil, "Crear
 * tarea" no obliga a elegir a nadie— no había manera de arreglarlo salvo
 * borrar la tarea entera y volver a escribirla de cero.
 */
export default function FormularioTarea({
  anio,
  miembros,
  tareaExistente,
  onGuardada,
  onCancelar,
}: {
  anio: number;
  miembros: MiembroSimple[];
  tareaExistente?: TareaListada | null;
  onGuardada: () => void;
  onCancelar?: () => void;
}) {
  const editando = Boolean(tareaExistente);

  const [titulo, setTitulo] = useState(tareaExistente?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(tareaExistente?.descripcion ?? "");
  const [fecha, setFecha] = useState(tareaExistente?.fecha ?? "");
  const [asignados, setAsignados] = useState<string[]>(
    tareaExistente?.asignados.map((a) => a.id) ?? [],
  );
  const [documentoNuevo, setDocumentoNuevo] = useState<File | null>(null);
  // Si ya había un documento adjunto y se pulsa "Quitar", se borra al guardar
  // sin necesidad de subir uno nuevo en su lugar.
  const [quitarDocumento, setQuitarDocumento] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const documentoActual =
    !quitarDocumento && tareaExistente?.documento_url
      ? { nombre: tareaExistente.documento_nombre ?? "Documento" }
      : null;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;

    setError(null);
    setGuardando(true);
    try {
      let documentoClave: string | null = quitarDocumento
        ? null
        : (tareaExistente?.documento_url ?? null);
      let documentoNombre: string | null = quitarDocumento
        ? null
        : (tareaExistente?.documento_nombre ?? null);

      if (documentoNuevo) {
        const res = await fetch("/api/r2/subir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: documentoNuevo.name,
            contentType: documentoNuevo.type,
            tamano: documentoNuevo.size,
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
          headers: { "Content-Type": documentoNuevo.type },
          body: documentoNuevo,
        });
        if (!subida.ok) throw new Error("Falló la subida del documento.");

        documentoClave = clave;
        documentoNombre = documentoNuevo.name;
      }

      const datos = {
        titulo,
        descripcion,
        fecha: fecha || null,
        asignados,
        documentoClave,
        documentoNombre,
      };

      if (tareaExistente) {
        await editarTarea(tareaExistente.id, datos);
      } else {
        await crearTarea(datos);
      }

      setTitulo("");
      setDescripcion("");
      setFecha("");
      setAsignados([]);
      setDocumentoNuevo(null);
      setQuitarDocumento(false);
      onGuardada();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
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
        {documentoActual ? (
          <div className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-sm">
            <Paperclip size={16} className="shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{documentoActual.nombre}</span>
            <button
              type="button"
              onClick={() => setQuitarDocumento(true)}
              aria-label="Quitar documento adjunto"
              className="shrink-0 cursor-pointer text-white/40 hover:text-red-400"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <label className="flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 text-sm transition-colors duration-200 hover:border-white/40">
            <Paperclip size={16} aria-hidden="true" />
            {documentoNuevo ? documentoNuevo.name : "Adjuntar documento (opcional)"}
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,image/*"
              className="sr-only"
              onChange={(e) => {
                setDocumentoNuevo(e.target.files?.[0] ?? null);
                setQuitarDocumento(false);
              }}
            />
          </label>
        )}
        {documentoNuevo && !documentoActual && (
          <button
            type="button"
            onClick={() => setDocumentoNuevo(null)}
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

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={guardando || !titulo.trim()}
          className="inline-flex min-h-[48px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-6 font-medium text-black transition-opacity duration-200 hover:opacity-85 disabled:opacity-40"
        >
          {guardando && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear tarea"}
        </button>
        {editando && onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            disabled={guardando}
            className="inline-flex min-h-[48px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/25 px-5 text-sm font-medium transition-colors duration-200 hover:bg-white/10 disabled:opacity-40"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
