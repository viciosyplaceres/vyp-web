"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Check, Trash2, Plus, ArrowRight, Receipt, Loader2 } from "lucide-react";
import Image from "next/image";
import Avatar from "./Avatar";
import { subirImagenFirmada, comprimirImagen } from "@/lib/subir-cloudinary";
import {
  crearDeuda,
  marcarDeuda,
  borrarDeuda,
} from "@/app/actions/gestion";

export type MiembroSimple = {
  id: string;
  nombre: string | null;
  usuario?: string | null;
  avatarUrl?: string | null;
};

export type DeudaListada = {
  id: string;
  deudor_id: string | null;
  acreedor_id: string | null;
  cantidad: number;
  descripcion: string | null;
  pagada: boolean;
  created_at: string;
  ticket_url: string | null;
};

/** `null` es "VYP" (la peña), la opción extra del desplegable. */
function nombreDe(id: string | null, miembros: MiembroSimple[]) {
  if (id === null) return "VYP";
  return miembros.find((m) => m.id === id)?.nombre ?? "Miembro";
}

/**
 * Avatar + nombre de una de las dos partes de la deuda. Cuando es la peña
 * entera (id nulo) no hay foto que enseñar, así que se pinta su inicial con
 * el mismo respaldo que usa `Avatar` para quien no tiene foto.
 */
function Parte({ id, miembros }: { id: string | null; miembros: MiembroSimple[] }) {
  const miembro = id ? miembros.find((m) => m.id === id) : null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Avatar
        nombre={id === null ? "VYP" : (miembro?.nombre ?? null)}
        avatarUrl={miembro?.avatarUrl}
        tamano={22}
      />
      {nombreDe(id, miembros)}
    </span>
  );
}

export default function PanelDeudas({
  deudas,
  miembros,
  esAdmin,
  puedeBorrar,
  userId,
}: {
  deudas: DeudaListada[];
  miembros: MiembroSimple[];
  /** Las deudas las ve toda la peña, pero solo la directiva las apunta. */
  esAdmin: boolean;
  /** Borrar (y marcar cualquiera) es de la directiva o el tesorero. */
  puedeBorrar: boolean;
  userId: string;
}) {
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const ticketRef = useRef<HTMLInputElement>(null);

  // El ticket se sube a Cloudinary en cuanto se elige la foto, y al formulario
  // solo viaja su URL: así el envío de la deuda no tiene que esperar a que
  // suba la imagen, y si la subida falla se ve antes de guardar nada.
  const [ticket, setTicket] = useState<{ url: string; storageId: string } | null>(null);
  const [subiendoTicket, setSubiendoTicket] = useState(false);
  const [errorTicket, setErrorTicket] = useState<string | null>(null);

  // El ticket se limpia dentro de la propia acción, no desde un efecto:
  // reaccionar al resultado con `useEffect` + `setState` encadena renders y
  // es justo lo que desaconseja React.
  const [estado, accion, pendiente] = useActionState(
    async (prev: { error?: string } | null, formData: FormData) => {
      const resultado = await crearDeuda(prev, formData);
      if (resultado && !resultado.error) setTicket(null);
      return resultado;
    },
    null,
  );

  useEffect(() => {
    if (estado && !estado.error) formRef.current?.reset();
  }, [estado]);

  async function elegirTicket(e: React.ChangeEvent<HTMLInputElement>) {
    const fichero = e.target.files?.[0];
    e.target.value = "";
    if (!fichero) return;

    setErrorTicket(null);
    setSubiendoTicket(true);
    try {
      const comprimida = await comprimirImagen(fichero, 1600);
      const subida = await subirImagenFirmada(comprimida, "ticket");
      setTicket({ url: subida.url, storageId: subida.storageId });
    } catch (err) {
      setErrorTicket(err instanceof Error ? err.message : "No se pudo subir el ticket.");
    } finally {
      setSubiendoTicket(false);
    }
  }

  const pendientes = deudas.filter((d) => !d.pagada);
  const totalPendiente = pendientes.reduce((s, d) => s + Number(d.cantidad), 0);

  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold">Deudas</h2>
      {deudas.length > 0 && (
        <p className="mt-1 text-sm text-white/50">
          {pendientes.length} pendientes
          {totalPendiente > 0 && ` · ${totalPendiente.toFixed(2)} € sin saldar`}
        </p>
      )}

      {esAdmin && (
      <form
        ref={formRef}
        action={accion}
        className="mt-4 space-y-3 rounded-xl border border-white/15 p-4"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="deudorD" className="text-sm text-white/70">
              Quién debe
            </label>
            <select
              id="deudorD"
              name="deudor"
              defaultValue=""
              className="min-h-[48px] w-full cursor-pointer rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
            >
              <option value="" className="bg-black">
                VYP (la peña)
              </option>
              {miembros.map((m) => (
                <option key={m.id} value={m.id} className="bg-black">
                  {m.nombre ?? "Miembro"}
                </option>
              ))}
            </select>
          </div>

          <ArrowRight
            size={18}
            className="mt-6 hidden shrink-0 text-white/30 sm:block"
            aria-hidden="true"
          />

          <div className="flex-1 space-y-1.5">
            <label htmlFor="acreedorD" className="text-sm text-white/70">
              A quién
            </label>
            <select
              id="acreedorD"
              name="acreedor"
              defaultValue=""
              className="min-h-[48px] w-full cursor-pointer rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
            >
              <option value="" className="bg-black">
                VYP (la peña)
              </option>
              {miembros.map((m) => (
                <option key={m.id} value={m.id} className="bg-black">
                  {m.nombre ?? "Miembro"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="w-full sm:w-32">
            <label htmlFor="cantidadD" className="sr-only">
              Cantidad en euros
            </label>
            <input
              id="cantidadD"
              name="cantidad"
              type="number"
              step="0.01"
              min="0.01"
              required
              inputMode="decimal"
              placeholder="Cantidad (€)"
              className="min-h-[48px] w-full rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="descripcionD" className="sr-only">
              Concepto
            </label>
            <input
              id="descripcionD"
              name="descripcion"
              placeholder="Concepto (opcional)"
              maxLength={200}
              className="min-h-[48px] w-full rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
            />
          </div>
        </div>

        {/* Foto del ticket: opcional, para justificar el gasto. */}
        <input type="hidden" name="ticketUrl" value={ticket?.url ?? ""} />
        <input type="hidden" name="ticketStorageId" value={ticket?.storageId ?? ""} />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => ticketRef.current?.click()}
            disabled={subiendoTicket}
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-white/25 px-4 text-sm transition-colors duration-200 hover:bg-white/10 disabled:opacity-50"
          >
            {subiendoTicket ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Receipt size={16} aria-hidden="true" />
            )}
            {subiendoTicket
              ? "Subiendo…"
              : ticket
                ? "Cambiar ticket"
                : "Foto del ticket (opcional)"}
          </button>
          <input
            ref={ticketRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={elegirTicket}
          />
          {ticket && (
            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/20">
              <Image src={ticket.url} alt="Ticket subido" fill sizes="44px" className="object-cover" />
            </span>
          )}
        </div>

        {errorTicket && (
          <p role="alert" className="text-sm text-red-400">
            {errorTicket}
          </p>
        )}

        {estado?.error && (
          <p role="alert" className="text-sm text-red-400">
            {estado.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pendiente}
          className="inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-5 font-medium text-black transition-opacity duration-200 hover:opacity-85 disabled:opacity-50"
        >
          <Plus size={18} aria-hidden="true" />
          {pendiente ? "Añadiendo…" : "Apuntar deuda"}
        </button>
      </form>
      )}

      <ul className="mt-6 space-y-2">
        {deudas.length === 0 && (
          <li className="text-sm text-white/40">No hay deudas apuntadas.</li>
        )}

        {deudas.map((d) => {
          // Puede marcarla: la directiva, el tesorero, o el propio acreedor
          // (a quien se le debe) si es un miembro concreto, no la peña.
          const puedeMarcar = puedeBorrar || d.acreedor_id === userId;
          return (
          <li
            key={d.id}
            className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5"
          >
            <button
              type="button"
              aria-label={
                d.pagada ? "Marcar como no saldada" : "Marcar como saldada"
              }
              aria-pressed={d.pagada}
              disabled={!puedeMarcar}
              onClick={() =>
                startTransition(() => {
                  void marcarDeuda(d.id, !d.pagada);
                })
              }
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
                d.pagada
                  ? "border-white bg-white text-black"
                  : "border-white/30 text-transparent"
              } ${puedeMarcar ? "cursor-pointer hover:border-white/60" : "cursor-default opacity-70"}`}
            >
              <Check size={18} aria-hidden="true" />
            </button>

            <div className="min-w-0 flex-1">
              <p
                className={`flex flex-wrap items-center gap-1.5 font-medium ${d.pagada ? "text-white/40 line-through" : ""}`}
              >
                <Parte id={d.deudor_id} miembros={miembros} /> →{" "}
                <Parte id={d.acreedor_id} miembros={miembros} />
              </p>
              <p className="truncate text-xs text-white/50">
                {[
                  `${Number(d.cantidad).toFixed(2)} €`,
                  d.descripcion,
                  d.pagada ? "Saldada" : "Pendiente",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>

            {d.ticket_url && (
              <a
                href={d.ticket_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ver el ticket"
                className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/20 transition-opacity duration-200 hover:opacity-80"
              >
                <Image src={d.ticket_url} alt="Ticket" fill sizes="40px" className="object-cover" />
              </a>
            )}

            {puedeBorrar && (
              <button
                type="button"
                aria-label="Borrar deuda"
                onClick={() =>
                  startTransition(() => {
                    void borrarDeuda(d.id);
                  })
                }
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/30 transition-colors duration-200 hover:text-red-400"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            )}
          </li>
          );
        })}
      </ul>
    </div>
  );
}
