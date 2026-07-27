import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { listarMiembros, indiceMiembros } from "@/lib/miembros";
import { obtenerAnioActivo } from "@/app/actions/configuracion";
import { diasLimpieza } from "@/lib/limpieza";
import PanelLimpieza, {
  type DiaTurno,
  type MiembroTurno,
} from "@/components/PanelLimpieza";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Limpieza",
  robots: { index: false, follow: false },
};

export default async function LimpiezaPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/login?next=/admin/limpieza");

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

  const [{ data: turnos }, { data: numeros }, miembros, indice] = await Promise.all([
    supabase.from("limpieza_turnos").select("fecha, perfil_id").eq("anio", anio),
    supabase.from("limpieza_numeros").select("perfil_id, numero").eq("anio", anio),
    listarMiembros(),
    indiceMiembros(),
  ]);

  const numeroDe = new Map<string, number>(
    (numeros ?? []).map((n) => [n.perfil_id, n.numero]),
  );

  const porFecha = new Map<string, MiembroTurno[]>();
  for (const t of turnos ?? []) {
    const m = indice.get(t.perfil_id);
    if (!m) continue;
    const lista = porFecha.get(t.fecha) ?? [];
    lista.push({
      id: m.id,
      nombre: m.nombre,
      usuario: m.usuario,
      avatarUrl: m.avatarUrl,
      numero: numeroDe.get(m.id) ?? null,
    });
    porFecha.set(t.fecha, lista);
  }

  const dias: DiaTurno[] = diasLimpieza(anio).map((d) => ({
    fecha: d.fecha,
    dia: d.dia,
    plazas: d.plazas,
    desmontaje: d.desmontaje,
    miembros: (porFecha.get(d.fecha) ?? []).sort((a, b) =>
      (a.nombre ?? "").localeCompare(b.nombre ?? "", "es"),
    ),
  }));

  const listaMiembros: MiembroTurno[] = miembros.map((m) => ({
    id: m.id,
    nombre: m.nombre,
    usuario: m.usuario,
    avatarUrl: m.avatarUrl,
    numero: numeroDe.get(m.id) ?? null,
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

        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Limpieza</h1>
        <p className="mt-1 text-sm text-white/50 tabular-nums">
          Del 22 al 31 de agosto de {anio}
        </p>

        <PanelLimpieza
          anio={anio}
          dias={dias}
          miembros={listaMiembros}
          esAdmin={sesion.esAdmin}
          userId={sesion.userId}
        />
      </div>
    </main>
  );
}
