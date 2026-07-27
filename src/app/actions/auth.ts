"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { avisarAdmins } from "@/lib/push";

export type EstadoFormulario = { error?: string } | null;

export async function iniciarSesion(
  _prevState: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  // Solo rutas relativas de un único slash: evita open redirect vía "next"
  // (p. ej. "//evil.com", "https://evil.com" o "/\evil.com", que algunos navegadores
  // interpretan como protocol-relative igual que "//").
  const destino =
    next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
      ? next
      : "/";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Email o contraseña incorrectos." };
  }

  redirect(destino);
}

export async function registrarse(
  _prevState: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const nombre = String(formData.get("nombre") ?? "");

  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre } },
  });

  if (error) {
    return { error: error.message };
  }

  // La directiva se entera al momento de que hay alguien esperando aprobación.
  await avisarAdmins({
    titulo: "Alguien quiere entrar en la peña",
    cuerpo: `${nombre.trim() || "Una persona nueva"} se ha registrado y espera aprobación.`,
    url: "/admin/miembros",
    tag: "altas",
  });

  redirect("/registro/gracias");
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
