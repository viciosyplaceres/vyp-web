import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ShoppingCart, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import PanelParticipantes from "@/components/PanelParticipantes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gestión",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/login?next=/admin");

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
  const { data: participantes } = await supabase
    .from("participantes")
    .select("id, nombre, pagado, importe, talla_camiseta, notas, anio")
    .order("anio", { ascending: false })
    .order("nombre", { ascending: true });

  return (
    <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold sm:text-3xl">Gestión</h1>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/admin/compras"
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-white/25 px-4 text-sm transition-colors duration-200 hover:bg-white/10"
          >
            <ShoppingCart size={16} aria-hidden="true" />
            Lista de la compra
          </Link>
          <Link
            href="/admin/miembros"
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-white/25 px-4 text-sm transition-colors duration-200 hover:bg-white/10"
          >
            <Users size={16} aria-hidden="true" />
            Miembros
          </Link>
        </div>

        <PanelParticipantes participantes={participantes ?? []} />
      </div>
    </main>
  );
}
