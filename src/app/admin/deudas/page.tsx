import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { listarMiembros } from "@/lib/miembros";
import PanelDeudas, { type DeudaListada } from "@/components/PanelDeudas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Deudas",
  robots: { index: false, follow: false },
};

export default async function DeudasPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/login?next=/admin/deudas");

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

  const [{ data: deudas }, miembros] = await Promise.all([
    supabase
      .from("deudas")
      .select(
        "id, deudor_id, acreedor_id, cantidad, descripcion, pagada, created_at, ticket_url",
      )
      .order("pagada", { ascending: true })
      .order("created_at", { ascending: false }),
    listarMiembros(),
  ]);

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

        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Deudas</h1>
        <p className="mt-1 text-sm text-white/50">
          Quién le debe dinero a quién, incluida la propia peña (VYP).
        </p>

        <PanelDeudas
          deudas={(deudas ?? []) as DeudaListada[]}
          miembros={miembros}
          esAdmin={sesion.esAdmin}
          puedeBorrar={sesion.esAdmin || sesion.esTesorero}
          userId={sesion.userId}
        />
      </div>
    </main>
  );
}
