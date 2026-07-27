"use client";

import { useTransition } from "react";
import { Check, Paperclip } from "lucide-react";
import { marcarTarea } from "@/app/actions/tareas";
import { alternarComprado } from "@/app/actions/gestion";

export type MiTarea = {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha: string | null;
  hecha: boolean;
  documento_url: string | null;
  documento_nombre: string | null;
};

export type MiCompra = {
  id: string;
  item: string;
  cantidad: number;
  comprado: boolean;
  anio: number;
};

/**
 * Lo que le toca a cada uno, con la casilla para marcarlo hecho. La base de
 * datos solo deja marcar lo que de verdad tienes asignado (política RLS), así
 * que esto no es la única barrera.
 */
export default function MisPendientes({
  tareas,
  compras,
}: {
  tareas: MiTarea[];
  compras: MiCompra[];
}) {
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold">Mis tareas</h2>
        {tareas.length === 0 ? (
          <p className="mt-2 text-sm text-white/40">
            No tienes ninguna tarea asignada.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {tareas.map((t) => (
              <li
                key={t.id}
                className="flex items-start gap-3 rounded-lg border border-white/10 px-3 py-3"
              >
                <button
                  type="button"
                  aria-label={
                    t.hecha
                      ? `Marcar ${t.titulo} como pendiente`
                      : `Marcar ${t.titulo} como hecha`
                  }
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
                  <p
                    className={`font-medium ${t.hecha ? "text-white/40 line-through" : ""}`}
                  >
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
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Lo que me toca comprar</h2>
        {compras.length === 0 ? (
          <p className="mt-2 text-sm text-white/40">
            No tienes nada asignado de la compra.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {compras.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5"
              >
                <button
                  type="button"
                  aria-label={
                    c.comprado
                      ? `Marcar ${c.item} como no comprado`
                      : `Marcar ${c.item} como comprado`
                  }
                  aria-pressed={c.comprado}
                  disabled={pendiente}
                  onClick={() =>
                    startTransition(() => {
                      void alternarComprado(c.id, !c.comprado);
                    })
                  }
                  className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors duration-200 ${
                    c.comprado
                      ? "border-white bg-white text-black"
                      : "border-white/30 text-transparent hover:border-white/60"
                  }`}
                >
                  <Check size={16} aria-hidden="true" />
                </button>

                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate font-medium ${c.comprado ? "text-white/40 line-through" : ""}`}
                  >
                    {c.item}
                  </p>
                  <p className="text-xs text-white/50">
                    {c.cantidad > 1 && `Cantidad: ${c.cantidad} · `}
                    <span className="tabular-nums">{c.anio}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
