import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSesion } from "@/lib/auth";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Miembros",
  robots: { index: false, follow: false },
};

export default async function MiembrosPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/login?next=/miembros");
  if (!sesion.esMiembro) redirect("/perfil");

  // `perfiles` solo se puede leer uno mismo (o siendo admin) por RLS: para
  // que cualquier miembro vea el directorio hace falta el cliente de
  // servicio, exponiendo aquí a propósito solo columnas no sensibles.
  const { data: miembros } = await createAdminClient()
    .from("perfiles")
    .select("id, nombre, usuario, avatar_url")
    .eq("aprobado", true)
    .order("nombre", { ascending: true });

  return (
    <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-semibold sm:text-3xl">
          Miembros de la peña
        </h1>

        <ul className="space-y-2">
          {(miembros ?? []).map((m) => (
            <li key={m.id}>
              <Link
                href={`/miembros/${m.id}`}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 px-4 py-3 transition-colors duration-200 hover:border-white/25 hover:bg-white/5"
              >
                <Avatar nombre={m.nombre} avatarUrl={m.avatar_url} tamano={40} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.nombre || "(sin nombre)"}</p>
                  {m.usuario && (
                    <p className="truncate text-xs text-white/50">@{m.usuario}</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
