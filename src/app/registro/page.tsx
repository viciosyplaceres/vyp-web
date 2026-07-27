"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registrarse } from "@/app/actions/auth";

export default function RegistroPage() {
  const [state, formAction, pending] = useActionState(registrarse, null);

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16">
      <form
        action={formAction}
        className="w-full max-w-sm space-y-5 border border-white/15 rounded-xl p-8"
      >
        <h1 className="text-2xl font-semibold">Únete a la peña</h1>
        <p className="text-sm text-white/60">
          Tu cuenta quedará pendiente de aprobación por la directiva antes de
          poder subir fotos, vídeos, música o comentar.
        </p>

        <div className="space-y-1">
          <label htmlFor="nombre" className="text-sm text-white/70">
            Nombre
          </label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            required
            className="w-full rounded-md bg-white/5 border border-white/20 px-3 py-2 outline-none focus:border-white"
          />
        </div>

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
            minLength={8}
            autoComplete="new-password"
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
          {pending ? "Creando cuenta…" : "Crear cuenta"}
        </button>

        <p className="text-sm text-white/60 text-center">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="underline">
            Entra
          </Link>
        </p>
      </form>
    </main>
  );
}
