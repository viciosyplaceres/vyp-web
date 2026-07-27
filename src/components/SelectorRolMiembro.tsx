"use client";

import { useState, useTransition } from "react";
import { cambiarRolMiembro } from "@/app/actions/miembros";

const OPCIONES = [
  { valor: "miembro", texto: "Miembro" },
  { valor: "tesorero", texto: "Tesorero" },
  { valor: "admin", texto: "Directiva" },
] as const;

type Rol = (typeof OPCIONES)[number]["valor"];

/**
 * Cambiar el rol de alguien ya aprobado (ascender a tesorero o directiva, o
 * volver a miembro normal). Solo aparece para quien puede repartir roles, y
 * nunca sobre la propia fila: cambiarse el rol a uno mismo está bloqueado
 * también en el servidor, para no poder quitarse la directiva por error.
 */
export default function SelectorRolMiembro({ id, rolActual }: { id: string; rolActual: Rol }) {
  const [rol, setRol] = useState<Rol>(rolActual);
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function cambiar(nuevo: Rol) {
    const anterior = rol;
    setRol(nuevo);
    setError(null);
    startTransition(async () => {
      try {
        await cambiarRolMiembro(id, nuevo);
      } catch (e) {
        setRol(anterior);
        setError(e instanceof Error ? e.message : "No se pudo cambiar el rol.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        value={rol}
        disabled={pendiente}
        onChange={(e) => cambiar(e.target.value as Rol)}
        aria-label="Cambiar rol"
        className="min-h-[36px] cursor-pointer rounded-lg border border-white/20 bg-white/5 px-2 text-xs text-white outline-none focus:border-white disabled:opacity-50"
      >
        {OPCIONES.map((o) => (
          <option key={o.valor} value={o.valor} className="bg-black">
            {o.texto}
          </option>
        ))}
      </select>
      {error && <p className="max-w-[180px] text-right text-xs text-red-400">{error}</p>}
    </div>
  );
}
