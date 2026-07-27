"use client";

import { useState, useTransition } from "react";
import { KeyRound, Trash2, Copy, Check } from "lucide-react";
import { resetearContrasena, eliminarMiembro } from "@/app/actions/miembros";

/**
 * Resetear y eliminar viven en un componente cliente aparte (a diferencia de
 * Aprobar/Revocar, que son formularios normales) porque resetear necesita
 * enseñar en pantalla la contraseña nueva, y eliminar necesita una
 * confirmación explícita al ser irreversible.
 */
export default function AccionesMiembro({
  id,
  nombre,
}: {
  id: string;
  nombre: string;
}) {
  const [pendiente, startTransition] = useTransition();
  const [nuevaContrasena, setNuevaContrasena] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetear() {
    if (
      !confirm(
        `¿Poner una contraseña nueva a ${nombre}? La actual dejará de funcionar al momento.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const nueva = await resetearContrasena(id);
        setNuevaContrasena(nueva);
        setCopiado(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo resetear.");
      }
    });
  }

  function eliminar() {
    if (
      !confirm(
        `¿Eliminar la cuenta de ${nombre} para siempre? Sus fotos, vídeos y música se quedan en la web, pero perderá el acceso, sus comentarios y sus mensajes del chat. No se puede deshacer.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await eliminarMiembro(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo eliminar.");
      }
    });
  }

  async function copiar() {
    if (!nuevaContrasena) return;
    await navigator.clipboard.writeText(nuevaContrasena).catch(() => undefined);
    setCopiado(true);
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={resetear}
          disabled={pendiente}
          aria-label={`Resetear la contraseña de ${nombre}`}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/20 text-white/60 transition-colors duration-200 hover:border-white/40 hover:text-white disabled:opacity-40"
        >
          <KeyRound size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={eliminar}
          disabled={pendiente}
          aria-label={`Eliminar la cuenta de ${nombre}`}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/20 text-white/60 transition-colors duration-200 hover:border-red-400/60 hover:text-red-400 disabled:opacity-40"
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>

      {error && <p className="max-w-[220px] text-right text-xs text-red-400">{error}</p>}

      {nuevaContrasena && (
        <div className="w-full max-w-[220px] rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-right">
          <p className="text-[11px] text-white/50">
            Nueva contraseña de {nombre} (solo se ve una vez):
          </p>
          <div className="mt-1 flex items-center justify-end gap-2">
            <code className="select-all text-sm font-semibold tracking-wide">
              {nuevaContrasena}
            </code>
            <button
              type="button"
              onClick={copiar}
              aria-label="Copiar contraseña"
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/50 hover:text-white"
            >
              {copiado ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
