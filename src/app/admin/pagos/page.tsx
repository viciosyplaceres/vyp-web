import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { listarMiembros } from "@/lib/miembros";
import { obtenerAnioActivo } from "@/app/actions/configuracion";
import PanelPagos, { type PagoMiembro } from "@/components/PanelPagos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pagos",
  robots: { index: false, follow: false },
};

export default async function PagosPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/login?next=/admin/pagos");

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

  const [{ data: pagos }, miembros] = await Promise.all([
    supabase.from("pagos").select("perfil_id, pagado").eq("anio", anio),
    listarMiembros(),
  ]);

  const pagadoPor = new Map<string, boolean>(
    (pagos ?? []).map((p) => [p.perfil_id, p.pagado]),
  );

  // Salen todos los miembros aprobados, hayan pagado o no: la lista sirve
  // justamente para ver quién falta.
  const lista: PagoMiembro[] = miembros.map((m) => ({
    id: m.id,
    nombre: m.nombre,
    usuario: m.usuario,
    avatarUrl: m.avatarUrl,
    pagado: pagadoPor.get(m.id) ?? false,
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

        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Pagos</h1>
        <p className="mt-1 text-sm text-white/50 tabular-nums">
          Cuota de las fiestas de {anio}
        </p>

        <PanelPagos anio={anio} miembros={lista} esAdmin={sesion.esAdmin} />
      </div>
    </main>
  );
}
