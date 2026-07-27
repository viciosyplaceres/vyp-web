"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Dices, SkipForward } from "lucide-react";
import Avatar from "./Avatar";
import { tirarMiembroLibre, type TiradaMiembroLibre } from "@/lib/dados";

export type MiembroSimple = {
  id: string;
  nombre: string | null;
  usuario: string | null;
  avatarUrl?: string | null;
};

const MS_DESCARTE = 170;
const MS_ACIERTO = 900;

/**
 * Lista de miembros con casillas para repartir una tarea o una compra entre
 * varias personas. No usa un `<select multiple>`, que en móvil es horrible.
 *
 * Cada uno sale con su avatar al lado, como en el resto de la app: en una peña
 * la gente se reconoce antes por la cara que por el nombre escrito.
 *
 * `permitirDados`: al lado del selector sale un botón de "Tirar dados" que
 * añade a alguien al azar (repitiendo la tirada si sale quien ya estaba
 * elegido). Si el que toca no quiere o no puede, se le quita a mano tocando
 * su chip, igual que a cualquier otro.
 */
export default function SelectorMiembros({
  miembros,
  seleccionados,
  onCambio,
  etiqueta = "Quién se encarga",
  permitirDados = true,
}: {
  miembros: MiembroSimple[];
  seleccionados: string[];
  onCambio: (ids: string[]) => void;
  etiqueta?: string;
  permitirDados?: boolean;
}) {
  const [guion, setGuion] = useState<TiradaMiembroLibre[] | null>(null);
  const [indice, setIndice] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  function alternar(id: string) {
    onCambio(
      seleccionados.includes(id)
        ? seleccionados.filter((x) => x !== id)
        : [...seleccionados, id],
    );
  }

  const cerrar = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current);
    setGuion(null);
    setIndice(0);
  }, []);

  useEffect(() => {
    if (!guion) return;
    if (indice >= guion.length) return;
    const t = guion[indice];
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
      const excluidos = seleccionados
        .map((id) => miembros.findIndex((m) => m.id === id))
        .filter((i) => i >= 0);
      const r = tirarMiembroLibre(miembros.length, excluidos);
      setIndice(0);
      setGuion(r.tiradas);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo tirar.");
    }
  }

  const tiradaActual = guion?.[Math.min(indice, guion.length - 1)] ?? null;
  const terminada = guion ? indice >= guion.length - 1 && !!tiradaActual?.valida : false;

  function confirmarTirada() {
    if (tiradaActual?.valida && tiradaActual.miembro !== undefined) {
      const m = miembros[tiradaActual.miembro];
      if (m && !seleccionados.includes(m.id)) onCambio([...seleccionados, m.id]);
    }
    cerrar();
  }

  return (
    <fieldset className="space-y-2">
      {/* ---------- Animación del dado ---------- */}
      {guion && tiradaActual && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tirar dados para elegir a alguien"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-6"
        >
          <p className="mb-2 text-sm uppercase tracking-[0.2em] text-white/40">
            Tirando los dados
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
            {tiradaActual.valida && tiradaActual.miembro !== undefined ? (
              <>
                <p className="flex items-center gap-2 text-xl font-semibold">
                  <Avatar
                    nombre={miembros[tiradaActual.miembro]?.nombre}
                    avatarUrl={miembros[tiradaActual.miembro]?.avatarUrl}
                    tamano={28}
                  />
                  {miembros[tiradaActual.miembro]?.nombre ||
                    miembros[tiradaActual.miembro]?.usuario ||
                    "Miembro"}
                </p>
                <p className="text-sm text-white/50">¡le toca!</p>
              </>
            ) : (
              <p className="text-sm text-white/40">
                {tiradaActual.motivo === "ya-elegido"
                  ? "Ese ya estaba elegido"
                  : "Ese número no es de nadie"}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={confirmarTirada}
            className="mt-8 inline-flex min-h-[48px] cursor-pointer items-center gap-2 rounded-full border border-white/25 px-6 text-sm transition-colors duration-200 hover:bg-white/10"
          >
            <SkipForward size={16} aria-hidden="true" />
            {terminada ? "Vale" : "Ver el resultado ya"}
          </button>
        </div>
      )}

      <div className="flex items-baseline justify-between gap-3">
        <legend className="text-sm text-white/70">{etiqueta}</legend>
        {permitirDados && miembros.length >= 2 && (
          <button
            type="button"
            onClick={tirar}
            disabled={seleccionados.length >= miembros.length}
            className="inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded-full border border-white/20 px-3 text-xs text-white/70 transition-colors duration-200 hover:bg-white/10 disabled:opacity-40"
          >
            <Dices size={13} aria-hidden="true" />
            Tirar dados
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}

      {miembros.length === 0 ? (
        <p className="text-xs text-white/40">
          Todavía no hay miembros aprobados a los que asignar.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {miembros.map((m) => {
            const activo = seleccionados.includes(m.id);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => alternar(m.id)}
                  aria-pressed={activo}
                  className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border py-1 pl-1 pr-4 text-sm transition-colors duration-200 ${
                    activo
                      ? "border-white bg-white text-black"
                      : "border-white/25 text-white/70 hover:bg-white/10"
                  }`}
                >
                  <Avatar nombre={m.nombre} avatarUrl={m.avatarUrl} tamano={28} />
                  {activo && <Check size={14} aria-hidden="true" />}
                  {m.nombre || m.usuario || "Miembro"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
