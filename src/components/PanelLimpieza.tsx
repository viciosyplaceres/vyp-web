"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dices, Loader2, SkipForward, Trash2, Wrench } from "lucide-react";
import Avatar from "./Avatar";
import { tirarDadosLimpieza, borrarSorteoLimpieza } from "@/app/actions/limpieza";
import { PLAZAS_DESMONTAJE, type Tirada } from "@/lib/limpieza";
import { diaLegible } from "@/lib/formato";

export type MiembroTurno = {
  id: string;
  nombre: string | null;
  usuario: string | null;
  avatarUrl: string | null;
  numero: number | null;
};

export type DiaTurno = {
  fecha: string;
  plazas: number;
  desmontaje: boolean;
  miembros: MiembroTurno[];
};

/** Cuánto dura en pantalla cada tirada, según si valió o no. */
const MS_DESCARTE = 170;
const MS_ACIERTO = 520;

const MOTIVOS: Record<string, string> = {
  "sin-miembro": "Ese número no es de nadie",
  "repetido-dia": "Ya limpia ese día",
  "ya-tiene-lo-suyo": "Ya tiene sus turnos",
};

export default function PanelLimpieza({
  anio,
  dias,
  miembros,
  esAdmin,
  userId,
}: {
  anio: number;
  dias: DiaTurno[];
  miembros: MiembroTurno[];
  esAdmin: boolean;
  userId: string;
}) {
  const router = useRouter();
  const [tirando, setTirando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El guion que devolvió el servidor y por qué tirada va la animación.
  const [guion, setGuion] = useState<{
    tiradas: Tirada[];
    numeros: { perfilId: string; nombre: string | null; numero: number }[];
  } | null>(null);
  const [indice, setIndice] = useState(0);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const terminar = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current);
    setGuion(null);
    setIndice(0);
    // El reparto real ya está guardado; se recarga para pintarlo.
    router.refresh();
  }, [router]);

  // Va pasando de tirada en tirada. Los descartes vuelan, los aciertos se
  // quedan un momento para que dé tiempo a leer a quién le ha caído.
  useEffect(() => {
    if (!guion) return;
    if (indice >= guion.tiradas.length) {
      temporizador.current = setTimeout(terminar, 900);
      return;
    }
    const t = guion.tiradas[indice];
    temporizador.current = setTimeout(
      () => setIndice((i) => i + 1),
      t.valida ? MS_ACIERTO : MS_DESCARTE,
    );
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, [guion, indice, terminar]);

  async function tirar() {
    setError(null);
    setTirando(true);
    try {
      const r = await tirarDadosLimpieza(anio);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setIndice(0);
      setGuion({ tiradas: r.tiradas, numeros: r.numeros });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo sortear.");
    } finally {
      setTirando(false);
    }
  }

  async function borrar() {
    if (!confirm("¿Borrar el sorteo de la limpieza y dejarlo sin repartir?")) return;
    setError(null);
    await borrarSorteoLimpieza(anio).catch((e) =>
      setError(e instanceof Error ? e.message : "No se pudo borrar."),
    );
    router.refresh();
  }

  const hayReparto = dias.some((d) => d.miembros.length > 0);
  const tiradaActual = guion?.tiradas[Math.min(indice, guion.tiradas.length - 1)] ?? null;
  const nombreDe = (i?: number) =>
    i === undefined ? null : (guion?.numeros[i]?.nombre ?? "Miembro");

  const diasNormales = dias.filter((d) => !d.desmontaje);
  const diaDesmontaje = dias.find((d) => d.desmontaje);
  const totalTurnos = dias.reduce((s, d) => s + d.plazas, 0);
  const faltanMiembros = Math.max(0, PLAZAS_DESMONTAJE - miembros.length);

  return (
    <div className="mt-6">
      {/* ---------- Animación de los dados ---------- */}
      {guion && tiradaActual && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Sorteo de la limpieza"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-6"
        >
          <p className="mb-2 text-sm uppercase tracking-[0.2em] text-white/40">
            Día {diaLegible(tiradaActual.fecha)}
          </p>

          {/* El dado. La `key` reinicia la animación en cada tirada. */}
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

          <div className="mt-5 h-16 text-center">
            {tiradaActual.valida ? (
              <>
                <p className="text-xl font-semibold">{nombreDe(tiradaActual.miembro)}</p>
                <p className="text-sm text-white/50">¡le toca limpiar!</p>
              </>
            ) : (
              <p className="text-sm text-white/40">
                {MOTIVOS[tiradaActual.motivo ?? ""] ?? "Se repite la tirada"}
              </p>
            )}
          </div>

          <div className="mt-4 h-1 w-56 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-white transition-all duration-200"
              style={{ width: `${((indice + 1) / guion.tiradas.length) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-xs tabular-nums text-white/30">
            {guion.tiradas.filter((t, i) => t.valida && i <= indice).length} de{" "}
            {guion.tiradas.filter((t) => t.valida).length} turnos repartidos
          </p>

          <button
            type="button"
            onClick={terminar}
            className="mt-8 inline-flex min-h-[48px] cursor-pointer items-center gap-2 rounded-full border border-white/25 px-6 text-sm transition-colors duration-200 hover:bg-white/10"
          >
            <SkipForward size={16} aria-hidden="true" />
            Ver el resultado ya
          </button>
        </div>
      )}

      {/* ---------- Cómo funciona + botón de sortear ---------- */}
      <div className="rounded-xl border border-white/15 p-4">
        <p className="text-sm text-white/70">
          {diasNormales.length > 0 && (
            <>
              Del {diaLegible(diasNormales[0].fecha)} al{" "}
              {diaLegible(diasNormales[diasNormales.length - 1].fecha)} limpian{" "}
              <strong>2 personas cada día</strong>.{" "}
            </>
          )}
          {diaDesmontaje && (
            <>
              El {diaLegible(diaDesmontaje.fecha)} es{" "}
              <strong>limpieza y desmontaje</strong>, y ahí van <strong>3</strong>.
            </>
          )}
        </p>
        <p className="mt-2 text-xs text-white/50">
          Son {totalTurnos} turnos entre {miembros.length}{" "}
          {miembros.length === 1 ? "miembro" : "miembros"}, así que no toca a
          todos por igual. El sorteo reparte de la forma más equilibrada posible:
          nadie termina con más de un turno de diferencia respecto al resto. Con
          los 9 miembros previstos, todos limpian dos días y solo tres repiten el
          día de desmontaje. Cada uno tiene su número; si el dado saca un número
          que no es de nadie, o de alguien que ya va servido, se vuelve a tirar.
        </p>

        {faltanMiembros > 0 && (
          <p role="status" className="mt-3 text-sm text-amber-300">
            Ahora hay {miembros.length} miembros aprobados. Falta{faltanMiembros > 1 ? "n" : ""}{" "}
            {faltanMiembros} para poder cubrir las 3 plazas de limpieza y desmontaje.
          </p>
        )}

        {esAdmin && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={tirar}
              disabled={tirando || faltanMiembros > 0}
              className="inline-flex min-h-[48px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-5 font-medium text-black transition-opacity duration-200 hover:opacity-85 disabled:opacity-50"
            >
              {tirando ? (
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              ) : (
                <Dices size={18} aria-hidden="true" />
              )}
              {tirando
                ? "Tirando…"
                : faltanMiembros > 0
                  ? "Faltan miembros"
                  : hayReparto
                    ? "Volver a sortear"
                    : "Tirar los dados"}
            </button>
            {hayReparto && (
              <button
                type="button"
                onClick={borrar}
                aria-label="Borrar el sorteo"
                className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/25 text-white/40 transition-colors duration-200 hover:border-red-400/60 hover:text-red-400"
              >
                <Trash2 size={17} aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {hayReparto && esAdmin && (
          <p className="mt-2 text-xs text-white/40">
            Volver a sortear sustituye el reparto actual por uno nuevo.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-400">
            {error}
          </p>
        )}
      </div>

      {/* ---------- El calendario ---------- */}
      <ul className="mt-6 space-y-2">
        {dias.map((d) => {
          const meToca = d.miembros.some((m) => m.id === userId);
          return (
            <li
              key={d.fecha}
              className={`rounded-lg border px-3 py-3 ${
                meToca ? "border-white/40 bg-white/5" : "border-white/10"
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium">
                  {diaLegible(d.fecha)}
                  {d.desmontaje && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/70">
                      <Wrench size={10} aria-hidden="true" />
                      y desmontaje
                    </span>
                  )}
                </p>
                {meToca && (
                  <span className="shrink-0 text-xs font-medium text-white">Te toca</span>
                )}
              </div>

              {d.miembros.length === 0 ? (
                <p className="mt-1.5 text-sm text-white/40">
                  Sin sortear ({d.plazas} {d.plazas === 1 ? "persona" : "personas"})
                </p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                  {d.miembros.map((m) => (
                    <li key={m.id} className="flex items-center gap-2">
                      <Avatar nombre={m.nombre} avatarUrl={m.avatarUrl} tamano={28} />
                      <span className="text-sm">
                        {m.nombre || m.usuario || "Miembro"}
                        {m.id === userId && <span className="text-white/40"> (tú)</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {/* ---------- Los números del dado ---------- */}
      {miembros.some((m) => m.numero !== null) && (
        <section className="mt-8 border-t border-white/10 pt-6">
          <h2 className="text-sm font-medium text-white/70">Números del sorteo</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {miembros
              .filter((m) => m.numero !== null)
              .sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0))
              .map((m) => (
                <li
                  key={m.id}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 py-1 pl-1 pr-3"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-bold tabular-nums text-black">
                    {m.numero}
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
