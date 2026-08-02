"use client";

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { validarNuevaContrasena } from "@/lib/contrasena";

/**
 * Cambio de contraseña desde el perfil. Pensado sobre todo para las cuentas
 * que se entregan con una contraseña generada (la directiva de cada peña
 * nueva): al entrar por primera vez, la cambian por la suya.
 *
 * Se pide la contraseña actual y se vuelve a comprobar contra Auth antes de
 * cambiarla: si alguien deja el móvil abierto, nadie puede cambiarle la
 * contraseña sin saberla.
 */
export default function CambiarContrasena() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cambiada, setCambiada] = useState(false);

  async function cambiar(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado) return;

    setError(null);
    setCambiada(false);

    const problema = validarNuevaContrasena(actual, nueva, repetir);
    if (problema) {
      setError(problema);
      return;
    }

    setOcupado(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const email = user?.email;
      if (!email) {
        throw new Error("No se pudo comprobar tu cuenta. Recarga la página.");
      }

      // Primero se demuestra que conoce la actual: reautenticación real.
      const { error: errorEntrada } = await supabase.auth.signInWithPassword({
        email,
        password: actual,
      });
      if (errorEntrada) {
        throw new Error("La contraseña actual no es correcta.");
      }

      const { error: errorCambio } = await supabase.auth.updateUser({
        password: nueva,
      });
      if (errorCambio) {
        throw new Error("No se pudo cambiar la contraseña. Inténtalo de nuevo.");
      }

      setCambiada(true);
      setActual("");
      setNueva("");
      setRepetir("");
    } catch (fallo) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo cambiar la contraseña.",
      );
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={cambiar} className="space-y-5">
      <div className="flex items-start gap-3">
        <KeyRound size={19} className="mt-0.5 shrink-0 text-white/60" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-semibold">Cambiar contraseña</h2>
          <p className="mt-0.5 text-sm leading-relaxed text-white/50">
            Si entraste con una contraseña generada por la peña, cámbiala aquí
            por una que solo sepas tú.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="contrasenaActual" className="text-sm text-white/70">
          Contraseña actual
        </label>
        <input
          id="contrasenaActual"
          type="password"
          autoComplete="current-password"
          required
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          className="min-h-[48px] w-full rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="contrasenaNueva" className="text-sm text-white/70">
            Nueva contraseña
          </label>
          <input
            id="contrasenaNueva"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            className="min-h-[48px] w-full rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="contrasenaRepetir" className="text-sm text-white/70">
            Repite la nueva
          </label>
          <input
            id="contrasenaRepetir"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={repetir}
            onChange={(e) => setRepetir(e.target.value)}
            className="min-h-[48px] w-full rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
          />
        </div>
      </div>
      <p className="text-xs text-white/40">Mínimo 8 caracteres.</p>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      {cambiada && (
        <p role="status" className="text-sm text-white/70">
          Contraseña actualizada. La próxima vez que entres, usa la nueva.
        </p>
      )}

      <button
        type="submit"
        disabled={ocupado}
        className="inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-6 font-medium text-black transition-opacity duration-200 hover:opacity-85 disabled:opacity-40 sm:w-auto"
      >
        {ocupado && <Loader2 size={17} className="animate-spin" aria-hidden="true" />}
        {ocupado ? "Cambiando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
