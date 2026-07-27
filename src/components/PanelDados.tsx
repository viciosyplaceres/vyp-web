"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Dices, SkipForward } from "lucide-react";
import Avatar from "./Avatar";
import {
  tirarMayorMenor,
  tirarPorMiembro,
  type TiradaMayorMenor,
  type TiradaMiembro,
} from "@/lib/dados";

export type MiembroDado = {
  id: string;
  nombre: string | null;
  usuario: string | null;
  avatarUrl: string | null;
};

/** Cuánto dura en pantalla cada tirada, según si valió o no. */
const MS_DESCARTE = 170;
const MS_ACIERTO = 900;

type Modo = "mayor-menor" | "por-miembro";

type GuionMayorMenor = { modo: "mayor-menor"; tiradas: TiradaMayorMenor[] };
type GuionPorMiembro = { modo: "por-miembro"; tiradas: TiradaMiembro[] };
type Guion = GuionMayorMenor | GuionPorMiembro;

export default function PanelDados({ miembros }: { miembros: MiembroDado[] }) {
  const [modo, setModo] = useState<Modo>("mayor-menor");
  const [guion, setGuion] = useState<Guion | null>(null);
  const [indice, setIndice] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cerrar = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current);
    setGuion(null);
    setIndice(0);
  }, []);

  useEffect(() => {
    if (!guion) return;
    if (indice >= guion.tiradas.length) return;
    const t = guion.tiradas[indice];
    temporizador.current = setTimeout(
      () => setIndice((i) => i + 1),
      t.valida ? MS_ACIERTO : MS_DESCARTE,
    );
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, [guion, indice]);

  function tirar() {
    setError(null);
    try {
      if (modo === "mayor-menor") {
        const r = tirarMayorMenor();
        setIndice(0);
        setGuion({ modo: "mayor-menor", tiradas: r.tiradas });
      } else {
        const r = tirarPorMiembro(miembros.length);
        setIndice(0);
        setGuion({ modo: "por-miembro", tiradas: r.tiradas });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo tirar.");
    }
  }

  const tiradaActual = guion?.tiradas[Math.min(indice, guion.tiradas.length - 1)] ?? null;
  const terminada = guion ? indice >= guion.tiradas.length - 1 && !!tiradaActual?.valida : false;

  return (
    <div className="mt-6">
      {/* ---------- Animación del dado ---------- */}
      {guion && tiradaActual && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tirada de dados"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-6"
        >
          <p className="mb-2 text-sm uppercase tracking-[0.2em] text-white/40">
            {guion.modo === "mayor-menor" ? "Mayor o menor de 6" : "Por miembro"}
          </p>

          <div
            key={indice}
            className={`flex h-32 w-32 animate-[girar_0.35s_ease-out] items-center justify-center rounded-3xl border-4 text-6xl font-bold tabular-nums ${
              tiradaActual.valida
                ? "border-white bg-white text-black"
                : "border-white/25 bg-white/5 text-white/40"
            }`}
          >
            {tiradaActual.cara}
          </div>

          <div className="mt-5 flex h-16 flex-col items-center justify-center text-center">
            {tiradaActual.valida ? (
              guion.modo === "mayor-menor" ? (
                <p className="flex items-center gap-2 text-2xl font-semibold">
                  {(tiradaActual as TiradaMayorMenor).resultado === "mayor" ? (
                    <ArrowUp size={22} aria-hidden="true" />
                  ) : (
                    <ArrowDown size={22} aria-hidden="true" />
                  )}
                  {(tiradaActual as TiradaMayorMenor).resultado === "mayor"
                    ? "Mayor de 6"
                    : "Menor de 6"}
                </p>
              ) : (
                <>
                  <p className="text-xl font-semibold">
                    {miembros[(tiradaActual as TiradaMiembro).miembro ?? -1]?.nombre ||
                      miembros[(tiradaActual as TiradaMiembro).miembro ?? -1]?.usuario ||
                      "Miembro"}
                  </p>
                  <p className="text-sm text-white/50">¡le toca!</p>
                </>
              )
            ) : (
              <p className="text-sm text-white/40">
                {guion.modo === "mayor-menor" ? "Empate a 6, se repite" : "Ese número no es de nadie"}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={cerrar}
            className="mt-8 inline-flex min-h-[48px] cursor-pointer items-center gap-2 rounded-full border border-white/25 px-6 text-sm transition-colors duration-200 hover:bg-white/10"
          >
            <SkipForward size={16} aria-hidden="true" />
            {terminada ? "Cerrar" : "Ver el resultado ya"}
          </button>
        </div>
      )}

      {/* ---------- Selector de modo ---------- */}
      <div className="flex gap-2 rounded-full border border-white/15 p-1">
        {(
          [
            { valor: "mayor-menor" as const, texto: "Mayor o menor de 6" },
            { valor: "por-miembro" as const, texto: "Por miembro" },
          ]
        ).map((op) => (
          <button
            key={op.valor}
            type="button"
            onClick={() => setModo(op.valor)}
            className={`min-h-[40px] flex-1 cursor-pointer rounded-full text-sm font-medium transition-colors duration-200 ${
              modo === op.valor ? "bg-white text-black" : "text-white/60 hover:text-white"
            }`}
          >
            {op.texto}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-white/15 p-4">
        {modo === "mayor-menor" ? (
          <p className="text-sm text-white/60">
            Se tira un dado de 12 caras. Del 1 al 5 gana <strong>menor</strong>, del
            7 al 12 gana <strong>mayor</strong>. Si sale el 6, empate: se repite.
          </p>
        ) : miembros.length < 2 ? (
          <p className="text-sm text-white/60">
            Hacen falta al menos dos miembros aprobados para tirar por miembro.
          </p>
        ) : (
          <p className="text-sm text-white/60">
            Cada uno de los {miembros.length} miembros tiene su número. Si el dado
            saca uno que no es de nadie, se repite la tirada hasta que le toque a
            alguien.
          </p>
        )}

        <button
          type="button"
          onClick={tirar}
          disabled={modo === "por-miembro" && miembros.length < 2}
          className="mt-4 inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-5 font-medium text-black transition-opacity duration-200 hover:opacity-85 disabled:opacity-40"
        >
          <Dices size={18} aria-hidden="true" />
          Tirar
        </button>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-400">
            {error}
          </p>
        )}
      </div>

      {modo === "por-miembro" && miembros.length >= 2 && (
        <section className="mt-6">
          <h2 className="text-sm font-medium text-white/70">Quién es cada número</h2>
          <p className="mt-1 text-xs text-white/40">
            Solo para saber a quién le toca cada número mientras corre la
            animación; no se guarda en ningún sitio.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {miembros.map((m, i) => (
              <li
                key={m.id}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 py-1 pl-1 pr-3"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-bold tabular-nums text-black">
                  {i + 1}
                </span>
                <Avatar nombre={m.nombre} avatarUrl={m.avatarUrl} tamano={22} />
                <span className="text-sm">{m.nombre || m.usuario || "Miembro"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
