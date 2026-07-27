import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { aprobarMiembro, revocarMiembro } from "@/app/actions/miembros";
import AccionesMiembro from "@/components/AccionesMiembro";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Miembros",
  robots: { index: false, follow: false },
};

export default async function AdminMiembrosPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/login?next=/admin/miembros");

  if (!sesion.esAdmin) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16 text-center">
        <p className="max-w-sm text-white/60">
          Esta zona es solo para la directiva de la peña.
        </p>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: miembros, error } = await supabase
    .from("perfiles")
    .select("id, nombre, rol, aprobado, created_at")
    .order("aprobado", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="flex-1 px-4 py-16 text-center text-red-400">
        Error al cargar los miembros: {error.message}
      </main>
    );
  }

  const pendientes = miembros?.filter((m) => !m.aprobado).length ?? 0;

  return (
    <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/admin"
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-1 text-sm text-white/60 transition-colors duration-200 hover:text-white"
        >
          <ChevronLeft size={18} aria-hidden="true" />
          Gestión
        </Link>

        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Miembros</h1>
        {pendientes > 0 && (
          <p className="mt-1 text-sm text-white/50">
            {pendientes} {pendientes === 1 ? "cuenta pendiente" : "cuentas pendientes"} de aprobar
          </p>
        )}

        <ul className="mt-6 space-y-2">
          {miembros?.length === 0 && (
            <li className="text-white/50">Todavía no se ha registrado nadie.</li>
          )}

          {miembros?.map((m) => (
            <li
              key={m.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-white/15 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {m.nombre || "(sin nombre)"}
                </p>
                <p className="text-xs text-white/50">
                  {m.rol === "admin" ? "Directiva" : "Miembro"} ·{" "}
                  {m.aprobado ? "Aprobado" : "Pendiente"}
                </p>
              </div>

              {m.rol !== "admin" && (
                <div className="flex flex-col items-end gap-2">
                  <form
                    action={
                      m.aprobado
                        ? revocarMiembro.bind(null, m.id)
                        : aprobarMiembro.bind(null, m.id)
                    }
                  >
                    <button
                      type="submit"
                      className={`min-h-[44px] cursor-pointer rounded-full px-4 text-sm font-medium transition-colors duration-200 ${
                        m.aprobado
                          ? "border border-white/30 hover:bg-white/10"
                          : "bg-white text-black hover:opacity-85"
                      }`}
                    >
                      {m.aprobado ? "Revocar" : "Aprobar"}
                    </button>
                  </form>
                  <AccionesMiembro id={m.id} nombre={m.nombre || "este miembro"} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
