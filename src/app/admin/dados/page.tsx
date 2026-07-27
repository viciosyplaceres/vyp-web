import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { getSesion } from "@/lib/auth";
import { listarMiembros } from "@/lib/miembros";
import PanelDados, { type MiembroDado } from "@/components/PanelDados";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dados",
  robots: { index: false, follow: false },
};

export default async function DadosPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/login?next=/admin/dados");

  if (!sesion.esMiembro) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16 text-center">
        <p className="max-w-sm text-white/60">
          Tu cuenta todavía está pendiente de que la directiva la apruebe.
        </p>
      </main>
    );
  }

  const miembros = await listarMiembros();
  const listaMiembros: MiembroDado[] = miembros.map((m) => ({
    id: m.id,
    nombre: m.nombre,
    usuario: m.usuario,
    avatarUrl: m.avatarUrl,
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

        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Dados</h1>
        <p className="mt-1 text-sm text-white/50">
          Para decidir algo rápido y sin discutir: a cara o cruz, o eligiendo
          entre la peña.
        </p>

        <PanelDados miembros={listaMiembros} />
      </div>
    </main>
  );
}
