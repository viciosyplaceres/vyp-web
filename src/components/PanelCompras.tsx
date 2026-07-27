"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Check, Trash2, Plus, Users, Paperclip, X } from "lucide-react";
import {
  crearItemCompra,
  alternarComprado,
  borrarItemCompra,
  adjuntarDocumentoCompra,
} from "@/app/actions/gestion";
import { asignarCompra } from "@/app/actions/tareas";
import SelectorMiembros, { type MiembroSimple } from "./SelectorMiembros";
import Avatar from "./Avatar";

export type ItemCompra = {
  id: string;
  item: string;
  cantidad: number;
  comprado: boolean;
  anio: number;
  notas: string | null;
  documento_url: string | null;
  documento_nombre: string | null;
  asignados: MiembroSimple[];
};

// Hasta 2040, igual que en Participantes: para poder anotar la compra de una
// fiesta que se prepara con tiempo, no solo la del año en curso.
const ANIOS = Array.from({ length: 2040 - 2010 + 1 }, (_, i) => 2010 + i).reverse();

async function subirDocumento(archivo: File) {
  const res = await fetch("/api/r2/subir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nombre: archivo.name,
      contentType: archivo.type,
      tamano: archivo.size,
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
    headers: { "Content-Type": archivo.type },
    body: archivo,
  });
  if (!subida.ok) throw new Error("Falló la subida del documento.");
  return clave;
}

export default function PanelCompras({
  items,
  miembros,
  anioActivo,
}: {
  items: ItemCompra[];
  miembros: MiembroSimple[];
  anioActivo: number;
}) {
  // A quién se le encarga la compra se elige ya al apuntarla. Antes había que
  // crear el artículo y buscar después un icono discreto para repartirlo, y
  // por eso parecía que no se podía asignar a nadie.
  const [nuevosAsignados, setNuevosAsignados] = useState<string[]>([]);
  const [documentoNuevo, setDocumentoNuevo] = useState<File | null>(null);
  const [subiendoDoc, setSubiendoDoc] = useState(false);
  const [errorDoc, setErrorDoc] = useState<string | null>(null);

  const [estado, accion, pendiente] = useActionState(
    async (prev: { error?: string } | null, formData: FormData) => {
      formData.set("asignados", nuevosAsignados.join(","));
      if (documentoNuevo) {
        try {
          const clave = await subirDocumento(documentoNuevo);
          formData.set("documentoClave", clave);
          formData.set("documentoNombre", documentoNuevo.name);
        } catch (e) {
          return { error: e instanceof Error ? e.message : "No se pudo adjuntar el documento." };
        }
      }
      const resultado = await crearItemCompra(prev, formData);
      if (resultado && !resultado.error) {
        setNuevosAsignados([]);
        setDocumentoNuevo(null);
      }
      return resultado;
    },
    null,
  );
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  // Qué artículo tiene abierto el panel de reparto o el de documento.
  const [repartiendo, setRepartiendo] = useState<string | null>(null);
  const [documentando, setDocumentando] = useState<string | null>(null);

  useEffect(() => {
    if (estado && !estado.error) formRef.current?.reset();
  }, [estado]);

  async function alSubirDocumentoItem(itemId: string, archivo: File) {
    setErrorDoc(null);
    setSubiendoDoc(true);
    try {
      const clave = await subirDocumento(archivo);
      await adjuntarDocumentoCompra(itemId, clave, archivo.name);
    } catch (e) {
      setErrorDoc(e instanceof Error ? e.message : "No se pudo adjuntar el documento.");
    } finally {
      setSubiendoDoc(false);
    }
  }

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
              defaultValue={anioActivo}
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

        <SelectorMiembros
          etiqueta="Quién lo compra (opcional)"
          miembros={miembros}
          seleccionados={nuevosAsignados}
          onCambio={setNuevosAsignados}
        />

        <div className="space-y-1.5">
          {documentoNuevo ? (
            <div className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-sm">
              <Paperclip size={16} className="shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{documentoNuevo.name}</span>
              <button
                type="button"
                onClick={() => setDocumentoNuevo(null)}
                aria-label="Quitar documento"
                className="shrink-0 cursor-pointer text-white/40 hover:text-red-400"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <label className="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 text-sm transition-colors duration-200 hover:border-white/40">
              <Paperclip size={16} aria-hidden="true" />
              Adjuntar documento (opcional)
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,image/*"
                className="sr-only"
                onChange={(e) => setDocumentoNuevo(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
        </div>

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
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/50">
                      {i.cantidad > 1 && <span>Cantidad: {i.cantidad}</span>}
                      {i.asignados.length === 0 ? (
                        <span>Sin asignar</span>
                      ) : (
                        i.asignados.map((a) => (
                          <span key={a.id} className="inline-flex items-center gap-1">
                            <Avatar nombre={a.nombre} avatarUrl={a.avatarUrl} tamano={18} />
                            {a.nombre || a.usuario}
                          </span>
                        ))
                      )}
                      {i.documento_url && (
                        <a
                          href={`/api/r2/documento?clave=${encodeURIComponent(i.documento_url)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex cursor-pointer items-center gap-1 text-white/60 underline hover:text-white"
                        >
                          <Paperclip size={12} aria-hidden="true" />
                          {i.documento_nombre || "Documento"}
                        </a>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label={`Documento de ${i.item}`}
                    aria-expanded={documentando === i.id}
                    onClick={() =>
                      setDocumentando(documentando === i.id ? null : i.id)
                    }
                    className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ${
                      documentando === i.id
                        ? "text-white"
                        : "text-white/30 hover:text-white"
                    }`}
                  >
                    <Paperclip size={16} aria-hidden="true" />
                  </button>

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

                {documentando === i.id && (
                  <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                    {errorDoc && (
                      <p role="alert" className="text-xs text-red-400">
                        {errorDoc}
                      </p>
                    )}
                    {i.documento_url ? (
                      <div className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-sm">
                        <Paperclip size={16} className="shrink-0" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">
                          {i.documento_nombre || "Documento"}
                        </span>
                        <button
                          type="button"
                          disabled={subiendoDoc}
                          onClick={() =>
                            startTransition(() => {
                              void adjuntarDocumentoCompra(i.id, null, null);
                            })
                          }
                          aria-label="Quitar documento"
                          className="shrink-0 cursor-pointer text-white/40 hover:text-red-400 disabled:opacity-40"
                        >
                          <X size={16} aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 text-sm transition-colors duration-200 hover:border-white/40">
                        <Paperclip size={16} aria-hidden="true" />
                        {subiendoDoc ? "Subiendo…" : "Adjuntar documento"}
                        <input
                          type="file"
                          disabled={subiendoDoc}
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,image/*"
                          className="sr-only"
                          onChange={(e) => {
                            const archivo = e.target.files?.[0];
                            if (archivo) void alSubirDocumentoItem(i.id, archivo);
                          }}
                        />
                      </label>
                    )}
                  </div>
                )}

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
