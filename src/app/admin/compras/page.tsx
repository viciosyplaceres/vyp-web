import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { listarMiembros, indiceMiembros } from "@/lib/miembros";
import PanelCompras, { type ItemCompra } from "@/components/PanelCompras";
import type { MiembroSimple } from "@/components/SelectorMiembros";
import { obtenerAnioActivo } from "@/app/actions/configuracion";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lista de la compra",
  robots: { index: false, follow: false },
};

export default async function ComprasPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/login?next=/admin/compras");

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
  const anioActivo = await obtenerAnioActivo();

  const [{ data: items }, { data: asignaciones }, miembros, indice] =
    await Promise.all([
      supabase
        .from("lista_compra")
        .select("id, item, cantidad, comprado, anio, notas")
        .order("anio", { ascending: false })
        .order("comprado", { ascending: true }),
      // Solo los ids: el perfil se cruza contra el índice, porque un join
      // anidado a `perfiles` devolvería vacío para quien no sea admin.
      supabase.from("compra_miembros").select("item_id, perfil_id"),
      listarMiembros(),
      indiceMiembros(),
    ]);

  const porItem = new Map<string, MiembroSimple[]>();
  for (const a of asignaciones ?? []) {
    const perfil = indice.get(a.perfil_id);
    if (!perfil) continue;
    porItem.set(a.item_id, [...(porItem.get(a.item_id) ?? []), perfil]);
  }

  const lista: ItemCompra[] = (items ?? []).map((i) => ({
    ...i,
    asignados: porItem.get(i.id) ?? [],
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
          Lista de la compra
        </h1>

        <PanelCompras
          items={lista}
          miembros={miembros}
          anioActivo={anioActivo}
        />
      </div>
    </main>
  );
}
