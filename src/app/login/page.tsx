"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { iniciarSesion } from "@/app/actions/auth";
import { useTemporadaAbierta } from "@/components/Temporada";

export default function LoginPage() {
  return (
    <Suspense>
      <FormularioLogin />
    </Suspense>
  );
}

function FormularioLogin() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [state, formAction, pending] = useActionState(iniciarSesion, null);
  const temporadaAbierta = useTemporadaAbierta();

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16">
      <form
        action={formAction}
        className="w-full max-w-sm space-y-5 border border-white/15 rounded-xl p-8"
      >
        <h1 className="text-2xl font-semibold">Acceso de miembros</h1>
        <input type="hidden" name="next" value={next} />

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm text-white/70">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-md bg-white/5 border border-white/20 px-3 py-2 outline-none focus:border-white"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm text-white/70">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded-md bg-white/5 border border-white/20 px-3 py-2 outline-none focus:border-white"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-red-400">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-white text-black font-medium py-2 disabled:opacity-50"
        >
          {pending ? "Entrando…" : "Entrar"}
        </button>

        {temporadaAbierta && (
          <p className="text-sm text-white/60 text-center">
            ¿No tienes cuenta?{" "}
            <Link href="/registro" className="underline">
              Regístrate
            </Link>
          </p>
        )}
      </form>
    </main>
  );
}
