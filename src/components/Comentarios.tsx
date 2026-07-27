"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { comentarMedia } from "@/app/actions/comentarios";
import Avatar from "./Avatar";
import { fechaCortaConHora as fecha } from "@/lib/formato";

export type Comentario = {
  id: string;
  texto: string;
  created_at: string;
  autor: string | null;
  avatarUrl: string | null;
};

export default function Comentarios({
  mediaId,
  anio,
  comentarios,
  esMiembro,
  haySesion,
}: {
  mediaId: string;
  anio: number;
  comentarios: Comentario[];
  esMiembro: boolean;
  haySesion: boolean;
}) {
  const [estado, accion, pendiente] = useActionState(comentarMedia, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Vacía la caja al enviar bien, para poder escribir el siguiente.
  useEffect(() => {
    if (estado && !estado.error) formRef.current?.reset();
  }, [estado]);

  return (
    <section className="mt-8" aria-labelledby="titulo-comentarios">
      <h2 id="titulo-comentarios" className="text-lg font-semibold">
        Comentarios
      </h2>

      {esMiembro ? (
        <form ref={formRef} action={accion} className="mt-4">
          <input type="hidden" name="mediaId" value={mediaId} />
          <input type="hidden" name="anio" value={anio} />
          <label htmlFor="texto" className="sr-only">
            Escribe un comentario
          </label>
          <textarea
            id="texto"
            name="texto"
            rows={3}
            required
            maxLength={2000}
            placeholder="Escribe un comentario…"
            className="w-full resize-none rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-base outline-none transition-colors duration-200 focus:border-white"
          />
          {estado?.error && (
            <p role="alert" className="mt-2 text-sm text-red-400">
              {estado.error}
            </p>
          )}
          <button
            type="submit"
            disabled={pendiente}
            className="mt-2 min-h-[44px] cursor-pointer rounded-full bg-white px-5 text-sm font-medium text-black transition-opacity duration-200 hover:opacity-85 disabled:opacity-50"
          >
            {pendiente ? "Enviando…" : "Comentar"}
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-white/50">
          {haySesion
            ? "Tu cuenta todavía está pendiente de que la directiva la apruebe."
            : "Solo los miembros de la peña pueden comentar."}{" "}
          {!haySesion && (
            <Link href="/login" className="cursor-pointer underline hover:text-white">
              Acceder
            </Link>
          )}
        </p>
      )}

      <ul className="mt-6 space-y-4">
        {comentarios.length === 0 && (
          <li className="text-sm text-white/40">Sin comentarios todavía.</li>
        )}
        {comentarios.map((c) => (
          <li key={c.id} className="flex gap-2.5">
            <Avatar nombre={c.autor} avatarUrl={c.avatarUrl} tamano={32} />
            <div className="min-w-0 flex-1 border-l-2 border-white/15 pl-3">
              <p className="text-sm">
                <span className="font-medium">{c.autor ?? "Miembro"}</span>{" "}
                <span className="text-xs text-white/40">{fecha(c.created_at)}</span>
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-white/80">
                {c.texto}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
