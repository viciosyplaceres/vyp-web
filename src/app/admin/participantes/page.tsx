import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import PanelParticipantes, {
  type FichaParticipante,
} from "@/components/PanelParticipantes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Participantes",
  robots: { index: false, follow: false },
};

const PRIMER_ANIO = 2026;
const ULTIMO_ANIO = 2040;

export default async function ParticipantesPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string }>;
}) {
  const sesion = await getSesion();
  if (!sesion) redirect("/login?next=/admin/participantes");

  if (!sesion.esAdmin) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16 text-center">
        <p className="max-w-sm text-white/60">
          Esta zona es solo para la directiva de la peña.
        </p>
      </main>
    );
  }

  const { anio: anioTexto } = await searchParams;
  const anioNum = Number(anioTexto);
  const anio =
    Number.isInteger(anioNum) && anioNum >= PRIMER_ANIO && anioNum <= ULTIMO_ANIO
      ? anioNum
      : PRIMER_ANIO;

  const supabase = await createClient();

  const [{ data: miembros }, { data: fichasAnio }] = await Promise.all([
    supabase
      .from("perfiles")
      .select("id, nombre")
      .eq("aprobado", true)
      .order("nombre", { ascending: true }),
    supabase
      .from("participantes")
      .select("perfil_id, talla_camiseta, pagado, importe")
      .eq("anio", anio),
  ]);

  const porPerfil = new Map(
    (fichasAnio ?? []).map((f) => [f.perfil_id, f]),
  );

  const fichas: FichaParticipante[] = (miembros ?? []).map((m) => {
    const existente = porPerfil.get(m.id);
    return {
      perfilId: m.id,
      nombre: m.nombre,
      talla: existente?.talla_camiseta ?? null,
      pagado: existente?.pagado ?? false,
      importe: existente?.importe ?? null,
    };
  });

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
          Participantes
        </h1>
        <p className="mt-1 text-sm text-white/50">
          Todos los miembros aprobados, con su talla y su pago de cada año.
        </p>

        <PanelParticipantes anio={anio} fichas={fichas} />
      </div>
    </main>
  );
}
