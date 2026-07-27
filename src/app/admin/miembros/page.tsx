import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { aprobarMiembro, revocarMiembro } from "@/app/actions/miembros";

export default async function AdminMiembrosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/miembros");
  }

  const { data: miPerfil } = await supabase
    .from("perfiles")
    .select("rol, aprobado")
    .eq("id", user.id)
    .single();

  if (!miPerfil || miPerfil.rol !== "admin" || !miPerfil.aprobado) {
    return (
      <main className="flex-1 flex items-center justify-center px-4 py-16 text-center">
        <p className="text-white/70">
          No tienes acceso a esta página. Es solo para la directiva.
        </p>
      </main>
    );
  }

  const { data: miembros, error } = await supabase
    .from("perfiles")
    .select("id, nombre, rol, aprobado, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="flex-1 px-4 py-16 text-center text-red-400">
        Error al cargar los miembros: {error.message}
      </main>
    );
  }

  return (
    <main className="flex-1 px-4 py-12 max-w-3xl mx-auto w-full">
      <h1 className="text-2xl font-semibold mb-6">Miembros de la peña</h1>

      <div className="space-y-3">
        {miembros?.length === 0 && (
          <p className="text-white/60">Todavía no se ha registrado nadie.</p>
        )}

        {miembros?.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between border border-white/15 rounded-lg px-4 py-3"
          >
            <div>
              <p className="font-medium">{m.nombre || "(sin nombre)"}</p>
              <p className="text-xs text-white/50">
                {m.rol === "admin" ? "Directiva" : "Miembro"} ·{" "}
                {m.aprobado ? "Aprobado" : "Pendiente de aprobar"}
              </p>
            </div>

            {m.rol !== "admin" && (
              <form
                action={
                  m.aprobado
                    ? revocarMiembro.bind(null, m.id)
                    : aprobarMiembro.bind(null, m.id)
                }
              >
                <button
                  type="submit"
                  className={
                    m.aprobado
                      ? "text-sm border border-white/30 rounded-md px-3 py-1.5 hover:bg-white/10"
                      : "text-sm bg-white text-black rounded-md px-3 py-1.5 font-medium"
                  }
                >
                  {m.aprobado ? "Revocar" : "Aprobar"}
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
