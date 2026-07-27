import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import PanelTareas, { type TareaListada } from "@/components/PanelTareas";
import type { MiembroSimple } from "@/components/SelectorMiembros";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tareas",
  robots: { index: false, follow: false },
};

export default async function AdminTareasPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/login?next=/admin/tareas");

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

  const [{ data: tareas }, { data: asignaciones }, { data: miembros }] =
    await Promise.all([
      supabase
        .from("tareas")
        .select(
          "id, titulo, descripcion, fecha, hecha, documento_url, documento_nombre",
        )
        .order("fecha", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
      supabase
        .from("tareas_miembros")
        .select("tarea_id, perfiles(id, nombre, usuario)"),
      supabase
        .from("perfiles")
        .select("id, nombre, usuario")
        .eq("aprobado", true)
        .order("nombre", { ascending: true }),
    ]);

  // Se cruzan aquí en vez de con un join anidado: PostgREST devuelve la
  // relación con forma variable y así el tipo queda claro.
  const porTarea = new Map<string, MiembroSimple[]>();
  for (const a of asignaciones ?? []) {
    const rel = a.perfiles as unknown as MiembroSimple | MiembroSimple[] | null;
    const perfil = Array.isArray(rel) ? rel[0] : rel;
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
          tareas={lista}
          miembros={(miembros ?? []) as MiembroSimple[]}
        />
      </div>
    </main>
  );
}
