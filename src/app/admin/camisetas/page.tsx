import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { listarMiembros, indiceMiembros } from "@/lib/miembros";
import { obtenerAnioActivo } from "@/app/actions/configuracion";
import PanelCamisetas, {
  type DisenoCamiseta,
  type PedidoMiembro,
} from "@/components/PanelCamisetas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Camisetas",
  robots: { index: false, follow: false },
};

export default async function CamisetasPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/login?next=/admin/camisetas");

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

  const [{ data: camisetas }, { data: votos }, { data: pedidos }, miembros, indice] =
    await Promise.all([
      supabase
        .from("camisetas")
        .select("id, titulo, notas, url, subido_por")
        .eq("anio", anio)
        .order("created_at", { ascending: false }),
      supabase
        .from("camisetas_votos")
        .select("camiseta_id, perfil_id")
        .eq("anio", anio),
      supabase
        .from("pedidos_camiseta")
        .select("perfil_id, tallas")
        .eq("anio", anio),
      listarMiembros(),
      indiceMiembros(),
    ]);

  const votosPorCamiseta = new Map<string, number>();
  let miVoto: string | null = null;
  for (const v of votos ?? []) {
    votosPorCamiseta.set(v.camiseta_id, (votosPorCamiseta.get(v.camiseta_id) ?? 0) + 1);
    if (v.perfil_id === sesion.userId) miVoto = v.camiseta_id;
  }

  const disenos: DisenoCamiseta[] = (camisetas ?? []).map((c) => {
    const autor = c.subido_por ? indice.get(c.subido_por) : null;
    return {
      id: c.id,
      titulo: c.titulo,
      notas: c.notas,
      url: c.url,
      subidoPor: c.subido_por,
      subidoPorNombre: autor?.nombre ?? null,
      subidoPorAvatar: autor?.avatarUrl ?? null,
      votos: votosPorCamiseta.get(c.id) ?? 0,
      votadaPorMi: miVoto === c.id,
    };
  });

  const tallasPorPerfil = new Map<string, string[]>(
    (pedidos ?? []).map((p) => [p.perfil_id, p.tallas ?? []]),
  );

  // Salen TODOS los miembros, hayan pedido o no: la lista sirve justamente
  // para ver de quién falta saber la talla.
  const listaPedidos: PedidoMiembro[] = miembros.map((m) => ({
    id: m.id,
    nombre: m.nombre,
    usuario: m.usuario,
    avatarUrl: m.avatarUrl,
    tallas: tallasPorPerfil.get(m.id) ?? [],
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

        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Camisetas</h1>
        <p className="mt-1 text-sm text-white/50 tabular-nums">
          Fiestas de {anio}
        </p>

        <PanelCamisetas
          anio={anio}
          disenos={disenos}
          pedidos={listaPedidos}
          userId={sesion.userId}
          esAdmin={sesion.esAdmin}
        />
      </div>
    </main>
  );
}
