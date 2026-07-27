"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Heart, Trash2, Camera, Loader2, Trophy, Minus, Plus } from "lucide-react";
import Avatar from "./Avatar";
import VisorImagen from "./VisorImagen";
import {
  registrarCamiseta,
  votarCamiseta,
  borrarCamiseta,
  guardarPedidoCamiseta,
} from "@/app/actions/camisetas";
import { subirImagenFirmada, comprimirImagen } from "@/lib/subir-cloudinary";

export type DisenoCamiseta = {
  id: string;
  titulo: string | null;
  url: string;
  subidoPor: string | null;
  subidoPorNombre: string | null;
  subidoPorAvatar: string | null;
  votos: number;
  votadaPorMi: boolean;
};

export type PedidoMiembro = {
  id: string;
  nombre: string | null;
  usuario: string | null;
  avatarUrl: string | null;
  tallas: string[];
};

const TALLAS = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const MAX_CAMISETAS = 10;

export default function PanelCamisetas({
  anio,
  disenos,
  pedidos,
  userId,
  esAdmin,
}: {
  anio: number;
  disenos: DisenoCamiseta[];
  pedidos: PedidoMiembro[];
  userId: string;
  esAdmin: boolean;
}) {
  const [, startTransition] = useTransition();
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // Qué diseño se está viendo a pantalla completa (null = cerrado).
  const [verGrande, setVerGrande] = useState<DisenoCamiseta | null>(null);

  // El pedido se edita en local para que los botones respondan al instante;
  // el servidor guarda detrás.
  const [tallasPorMiembro, setTallasPorMiembro] = useState<Record<string, string[]>>(
    () => Object.fromEntries(pedidos.map((p) => [p.id, p.tallas])),
  );

  const masVotada = disenos.reduce<DisenoCamiseta | null>(
    (mejor, d) => (d.votos > 0 && (!mejor || d.votos > mejor.votos) ? d : mejor),
    null,
  );

  async function subirDiseno(e: React.ChangeEvent<HTMLInputElement>) {
    const fichero = e.target.files?.[0];
    e.target.value = "";
    if (!fichero) return;

    setError(null);
    setSubiendo(true);
    try {
      const comprimida = await comprimirImagen(fichero, 1600);
      const subida = await subirImagenFirmada(comprimida, "camiseta", anio);
      await registrarCamiseta({
        anio,
        titulo: titulo.trim() || null,
        url: subida.url,
        storageId: subida.storageId,
        bytes: subida.bytes,
      });
      setTitulo("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el diseño.");
    } finally {
      setSubiendo(false);
    }
  }

  function cambiarCantidad(miembroId: string, delta: number) {
    const actuales = tallasPorMiembro[miembroId] ?? [];
    const nuevas =
      delta > 0
        ? [...actuales, "M"].slice(0, MAX_CAMISETAS)
        : actuales.slice(0, -1);

    setTallasPorMiembro((prev) => ({ ...prev, [miembroId]: nuevas }));
    startTransition(() => {
      void guardarPedidoCamiseta(miembroId, anio, nuevas).catch(() => undefined);
    });
  }

  function cambiarTalla(miembroId: string, indice: number, talla: string) {
    const nuevas = [...(tallasPorMiembro[miembroId] ?? [])];
    nuevas[indice] = talla;
    setTallasPorMiembro((prev) => ({ ...prev, [miembroId]: nuevas }));
    startTransition(() => {
      void guardarPedidoCamiseta(miembroId, anio, nuevas).catch(() => undefined);
    });
  }

  const totalCamisetas = Object.values(tallasPorMiembro).reduce(
    (s, t) => s + t.length,
    0,
  );

  return (
    <div className="mt-6 space-y-10">
      {/* ---------- Diseños y votación ---------- */}
      <section>
        <h2 className="text-lg font-semibold">Diseños</h2>
        <p className="mt-1 text-sm text-white/50">
          Sube una foto de una camiseta y vota la que más te guste. Cada uno
          tiene un voto: si votas otra, se te cambia.
        </p>

        <div className="mt-4 space-y-2 rounded-xl border border-white/15 p-4">
          <label htmlFor="tituloCamiseta" className="text-sm text-white/70">
            Nombre del diseño (opcional)
          </label>
          <input
            id="tituloCamiseta"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={120}
            placeholder="La del año pasado pero en negro"
            className="min-h-[48px] w-full rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={subiendo}
            className="inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-5 font-medium text-black transition-opacity duration-200 hover:opacity-85 disabled:opacity-50"
          >
            {subiendo ? (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              <Camera size={18} aria-hidden="true" />
            )}
            {subiendo ? "Subiendo…" : "Subir un diseño"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={subirDiseno}
          />
          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}
        </div>

        {disenos.length === 0 ? (
          <p className="mt-4 text-sm text-white/40">
            Todavía no hay ningún diseño propuesto para {anio}.
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {disenos.map((d) => {
              const esLaMasVotada = masVotada?.id === d.id;
              return (
                <li
                  key={d.id}
                  className={`overflow-hidden rounded-xl border ${
                    esLaMasVotada ? "border-white" : "border-white/15"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setVerGrande(d)}
                    aria-label={`Ver ${d.titulo ?? "diseño"} a pantalla completa`}
                    className="relative block aspect-square w-full cursor-zoom-in bg-white/5"
                  >
                    <Image
                      src={d.url}
                      alt={d.titulo ?? "Diseño de camiseta"}
                      fill
                      sizes="(max-width: 640px) 50vw, 33vw"
                      className="object-cover"
                    />
                    {esLaMasVotada && (
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-black">
                        <Trophy size={11} aria-hidden="true" />
                        La más votada
                      </span>
                    )}
                  </button>

                  <div className="space-y-2 p-2.5">
                    {d.titulo && (
                      <p className="truncate text-sm font-medium">{d.titulo}</p>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Avatar
                        nombre={d.subidoPorNombre}
                        avatarUrl={d.subidoPorAvatar}
                        tamano={20}
                      />
                      <span className="truncate text-xs text-white/50">
                        {d.subidoPorNombre ?? "Miembro"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          startTransition(() => {
                            void votarCamiseta(d.id, anio);
                          })
                        }
                        aria-pressed={d.votadaPorMi}
                        aria-label={
                          d.votadaPorMi
                            ? "Quitar mi voto"
                            : `Votar ${d.titulo ?? "este diseño"}`
                        }
                        className={`inline-flex min-h-[40px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full border text-sm transition-colors duration-200 ${
                          d.votadaPorMi
                            ? "border-white bg-white text-black"
                            : "border-white/25 text-white/70 hover:bg-white/10"
                        }`}
                      >
                        <Heart
                          size={14}
                          aria-hidden="true"
                          fill={d.votadaPorMi ? "currentColor" : "none"}
                        />
                        <span className="tabular-nums">{d.votos}</span>
                      </button>

                      {(esAdmin || d.subidoPor === userId) && (
                        <button
                          type="button"
                          onClick={() =>
                            startTransition(() => {
                              void borrarCamiseta(d.id);
                            })
                          }
                          aria-label="Borrar diseño"
                          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/30 transition-colors duration-200 hover:text-red-400"
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---------- Pedido: cuántas y de qué talla ---------- */}
      <section className="border-t border-white/10 pt-8">
        <h2 className="text-lg font-semibold">Tallas y cantidades</h2>
        <p className="mt-1 text-sm text-white/50">
          {totalCamisetas > 0
            ? `${totalCamisetas} camisetas en total para ${anio}.`
            : `Nadie ha pedido camisetas todavía para ${anio}.`}
        </p>

        <ul className="mt-4 space-y-2">
          {pedidos.map((m) => {
            const tallas = tallasPorMiembro[m.id] ?? [];
            const puedeEditar = esAdmin || m.id === userId;

            return (
              <li
                key={m.id}
                className="rounded-lg border border-white/10 px-3 py-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar nombre={m.nombre} avatarUrl={m.avatarUrl} tamano={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {m.nombre || m.usuario || "Miembro"}
                      {m.id === userId && (
                        <span className="text-white/40"> (tú)</span>
                      )}
                    </p>
                    <p className="text-xs text-white/50">
                      {tallas.length === 0
                        ? "Sin camisetas"
                        : `${tallas.length} ${tallas.length === 1 ? "camiseta" : "camisetas"}`}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(m.id, -1)}
                      disabled={!puedeEditar || tallas.length === 0}
                      aria-label={`Una camiseta menos para ${m.nombre ?? "este miembro"}`}
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/25 text-white/70 transition-colors duration-200 hover:bg-white/10 disabled:opacity-30"
                    >
                      <Minus size={15} aria-hidden="true" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums">
                      {tallas.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(m.id, 1)}
                      disabled={!puedeEditar || tallas.length >= MAX_CAMISETAS}
                      aria-label={`Una camiseta más para ${m.nombre ?? "este miembro"}`}
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/25 text-white/70 transition-colors duration-200 hover:bg-white/10 disabled:opacity-30"
                    >
                      <Plus size={15} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Un desplegable de talla por cada camiseta pedida. */}
                {tallas.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
                    {tallas.map((talla, i) => (
                      <label
                        key={i}
                        className="flex items-center gap-1.5 text-xs text-white/50"
                      >
                        <span className="tabular-nums">#{i + 1}</span>
                        <select
                          value={talla}
                          disabled={!puedeEditar}
                          onChange={(e) => cambiarTalla(m.id, i, e.target.value)}
                          aria-label={`Talla de la camiseta ${i + 1} de ${m.nombre ?? "este miembro"}`}
                          className="min-h-[40px] cursor-pointer rounded-lg border border-white/20 bg-white/5 px-2 text-sm text-white outline-none focus:border-white disabled:opacity-50"
                        >
                          {TALLAS.map((t) => (
                            <option key={t} value={t} className="bg-black">
                              {t}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {verGrande && (
        <VisorImagen
          src={verGrande.url}
          alt={verGrande.titulo ?? "Diseño de camiseta"}
          onCerrar={() => setVerGrande(null)}
        />
      )}
    </div>
  );
}
