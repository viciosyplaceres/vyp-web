import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { listarMiembros, indiceMiembros } from "@/lib/miembros";
import PanelTareas, { type TareaListada } from "@/components/PanelTareas";
import type { MiembroSimple } from "@/components/SelectorMiembros";
import { obtenerAnioActivo } from "@/app/actions/configuracion";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tareas",
  robots: { index: false, follow: false },
};

export default async function AdminTareasPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/login?next=/admin/tareas");

  if (!sesion.esMiembro) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16 text-center">
        <p className="max-w-sm text-white/60">
          Tu cuenta todavía está pendiente de que la directiva la apruebe.
        </p>
      </main>
    );
  }

  const supabase = await createClient();
  const anio = await obtenerAnioActivo();

  const [{ data: tareas }, { data: asignaciones }, miembros, indice] =
    await Promise.all([
      supabase
        .from("tareas")
        .select(
          "id, titulo, descripcion, fecha, hecha, documento_url, documento_nombre",
        )
        // Solo las del año que se está gestionando ahora, más las que no
        // tienen día fijado todavía (no pertenecen a ningún año en concreto).
        .or(`fecha.is.null,and(fecha.gte.${anio}-01-01,fecha.lte.${anio}-12-31)`)
        .order("fecha", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
      // Solo los ids: un join anidado a `perfiles` devolvería vacío para
      // quien no sea admin, y la gestión ya la ve toda la peña.
      supabase.from("tareas_miembros").select("tarea_id, perfil_id"),
      listarMiembros(),
      indiceMiembros(),
    ]);

  const porTarea = new Map<string, MiembroSimple[]>();
  for (const a of asignaciones ?? []) {
    const perfil = indice.get(a.perfil_id);
    if (!perfil) continue;
    porTarea.set(a.tarea_id, [...(porTarea.get(a.tarea_id) ?? []), perfil]);
  }

  const lista: TareaListada[] = (tareas ?? []).map((t) => ({
    ...t,
    asignados: porTarea.get(t.id) ?? [],
  }));

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

        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
          Tareas de las fiestas
        </h1>
        <p className="mt-1 text-sm text-white/50">
          Reparte el trabajo de agosto entre la peña. Cada uno ve lo suyo en su
          perfil.
        </p>

        <PanelTareas
          anio={anio}
          tareas={lista}
          miembros={miembros}
        />
      </div>
    </main>
  );
}
