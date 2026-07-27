import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { aplanarRelacion } from "@/lib/relaciones";
import { indiceMiembros } from "@/lib/miembros";
import { obtenerAnioActivo } from "@/app/actions/configuracion";
import { cerrarSesion } from "@/app/actions/auth";
import AvisosPush from "@/components/AvisosPush";
import EditarPerfil from "@/components/EditarPerfil";
import MisPendientes, {
  type MiTarea,
  type MiCompra,
} from "@/components/MisPendientes";
import MiGaleria, { type MiFoto } from "@/components/MiGaleria";
import MiMusica, { type MiPista } from "@/components/MiMusica";
import MiResumenPena, { type DeudaResumen } from "@/components/MiResumenPena";

export const dynamic = "force-dynamic";

// Solo se enseña un puñado de lo más reciente: listar TODO lo que alguien ha
// subido en años de peña haría crecer la página sin límite (era justo el
// problema a evitar). El resto se ve en "Ver todas".
const LIMITE_PREVIA = 9;

export const metadata: Metadata = {
  title: "Mi perfil",
  robots: { index: false, follow: false },
};

export default async function PerfilPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/login?next=/perfil");

  const supabase = await createClient();
  const anio = await obtenerAnioActivo();

  // Quien todavía no está aprobado no tiene nada asignado ni ha subido nada,
  // así que se le ahorran las consultas.
  const [
    misFotos,
    totalFotos,
    misPistas,
    totalPistas,
    misTareas,
    misCompras,
    miPedido,
    miPago,
    misDeudas,
    indice,
  ] = sesion.esMiembro
      ? await Promise.all([
          supabase
            .from("media")
            .select("id, anio, tipo, url, thumb_url, descripcion")
            .eq("subido_por", sesion.userId)
            .order("created_at", { ascending: false })
            .limit(LIMITE_PREVIA),
          supabase
            .from("media")
            .select("id", { count: "exact", head: true })
            .eq("subido_por", sesion.userId),
          supabase
            .from("pistas")
            .select("id, titulo, artista, tipo, origen")
            .eq("subido_por", sesion.userId)
            .order("created_at", { ascending: false })
            .limit(LIMITE_PREVIA),
          supabase
            .from("pistas")
            .select("id", { count: "exact", head: true })
            .eq("subido_por", sesion.userId),
          supabase
            .from("tareas_miembros")
            .select(
              "tareas(id, titulo, descripcion, fecha, hecha, documento_url, documento_nombre)",
            )
            .eq("perfil_id", sesion.userId),
          supabase
            .from("compra_miembros")
            .select("lista_compra(id, item, cantidad, comprado, anio)")
            .eq("perfil_id", sesion.userId),
          supabase
            .from("pedidos_camiseta")
            .select("tallas")
            .eq("perfil_id", sesion.userId)
            .eq("anio", anio)
            .maybeSingle(),
          supabase
            .from("pagos")
            .select("pagado")
            .eq("perfil_id", sesion.userId)
            .eq("anio", anio)
            .maybeSingle(),
          // Las deudas donde aparezco, deba yo o me deban a mí.
          supabase
            .from("deudas")
            .select("id, deudor_id, acreedor_id, cantidad, descripcion, pagada")
            .or(`deudor_id.eq.${sesion.userId},acreedor_id.eq.${sesion.userId}`)
            .order("pagada", { ascending: true }),
          indiceMiembros(),
        ])
      : [null, null, null, null, null, null, null, null, null, null];

  const tareasSinEncargados = aplanarRelacion<Omit<MiTarea, "asignados">>(
    misTareas?.data,
    "tareas",
  ).sort((a, b) => (a.fecha ?? "9999").localeCompare(b.fecha ?? "9999"));
  const comprasSinEncargados = aplanarRelacion<Omit<MiCompra, "asignados">>(
    misCompras?.data,
    "lista_compra",
  );

  // Con quién más se comparte cada tarea o compra: sin esto, alguien veía su
  // tarea en su perfil pero nunca sabía si la llevaba solo o acompañado, ni
  // con quién. Se piden en un segundo viaje porque hasta aquí no se conocían
  // los ids (vienen del embed de arriba).
  const idsTareas = tareasSinEncargados.map((t) => t.id);
  const idsCompras = comprasSinEncargados.map((c) => c.id);

  const [{ data: coTareas }, { data: coCompras }] = sesion.esMiembro
    ? await Promise.all([
        idsTareas.length
          ? supabase.from("tareas_miembros").select("tarea_id, perfil_id").in("tarea_id", idsTareas)
          : Promise.resolve({ data: [] }),
        idsCompras.length
          ? supabase.from("compra_miembros").select("item_id, perfil_id").in("item_id", idsCompras)
          : Promise.resolve({ data: [] }),
      ])
    : [{ data: [] }, { data: [] }];

  function encargadosDe(perfilId: string) {
    const m = indice?.get(perfilId);
    return m ? { id: m.id, nombre: m.nombre, usuario: m.usuario, avatarUrl: m.avatarUrl } : null;
  }

  const encargadosPorTarea = new Map<string, MiTarea["asignados"]>();
  for (const a of coTareas ?? []) {
    const m = encargadosDe(a.perfil_id);
    if (!m) continue;
    encargadosPorTarea.set(a.tarea_id, [...(encargadosPorTarea.get(a.tarea_id) ?? []), m]);
  }
  const encargadosPorCompra = new Map<string, MiCompra["asignados"]>();
  for (const a of coCompras ?? []) {
    const m = encargadosDe(a.perfil_id);
    if (!m) continue;
    encargadosPorCompra.set(a.item_id, [...(encargadosPorCompra.get(a.item_id) ?? []), m]);
  }

  const tareas: MiTarea[] = tareasSinEncargados.map((t) => ({
    ...t,
    asignados: encargadosPorTarea.get(t.id) ?? [],
  }));
  const compras: MiCompra[] = comprasSinEncargados.map((c) => ({
    ...c,
    asignados: encargadosPorCompra.get(c.id) ?? [],
  }));

  const deudasResumen: DeudaResumen[] = (misDeudas?.data ?? []).map((d) => {
    const loDeboYo = d.deudor_id === sesion.userId;
    const otroId = loDeboYo ? d.acreedor_id : d.deudor_id;
    const otro = otroId ? (indice?.get(otroId) ?? null) : null;
    return {
      id: d.id,
      cantidad: d.cantidad,
      descripcion: d.descripcion,
      pagada: d.pagada,
      otro: otro ? { nombre: otro.nombre, avatarUrl: otro.avatarUrl } : null,
      loDeboYo,
    };
  });

  return (
    <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl space-y-10">
        <section>
          <h1 className="mb-5 text-2xl font-semibold sm:text-3xl">Mi perfil</h1>
          <EditarPerfil
            nombre={sesion.nombre}
            usuario={sesion.usuario}
            avatarUrl={sesion.avatarUrl}
            bio={sesion.bio}
          />
          <p className="mt-3 text-sm text-white/50">
            {sesion.esAdmin
              ? "Directiva de la peña"
              : sesion.esMiembro
                ? "Miembro de la peña"
                : "Cuenta pendiente de que la directiva la apruebe"}
          </p>
          {sesion.esMiembro && (
            <Link
              href="/miembros"
              className="mt-3 inline-block cursor-pointer text-sm text-white/50 underline hover:text-white"
            >
              Ver miembros de la peña
            </Link>
          )}
        </section>

        {sesion.esMiembro && (
          <>
            <section className="border-t border-white/10 pt-8">
              <MiResumenPena
                anio={anio}
                tallas={miPedido?.data?.tallas ?? []}
                pagado={miPago?.data?.pagado ?? false}
                deudas={deudasResumen}
              />
            </section>

            <section className="border-t border-white/10 pt-8">
              <MisPendientes tareas={tareas} compras={compras} userId={sesion.userId} />
            </section>

            <section className="border-t border-white/10 pt-8">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-lg font-semibold">Mis fotos y vídeos</h2>
                {(totalFotos?.count ?? 0) > LIMITE_PREVIA && (
                  <Link
                    href="/perfil/galeria"
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-sm text-white/50 transition-colors duration-200 hover:text-white"
                  >
                    Ver todas
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                )}
              </div>
              <MiGaleria fotos={(misFotos?.data ?? []) as MiFoto[]} />
            </section>

            <section className="border-t border-white/10 pt-8">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-lg font-semibold">Mi música</h2>
                {(totalPistas?.count ?? 0) > LIMITE_PREVIA && (
                  <Link
                    href="/perfil/musica"
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-sm text-white/50 transition-colors duration-200 hover:text-white"
                  >
                    Ver todas
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                )}
              </div>
              <MiMusica pistas={(misPistas?.data ?? []) as MiPista[]} />
              <Link
                href="/musica"
                className="mt-3 inline-block cursor-pointer text-sm text-white/50 underline hover:text-white"
              >
                Ir a Música
              </Link>
            </section>
          </>
        )}

        <section className="border-t border-white/10 pt-8">
          <h2 className="text-lg font-semibold">Ajustes</h2>

          <div className="mt-4">
            <p className="mb-1 text-sm text-white/70">Notificaciones</p>
            <p className="mb-2 text-xs text-white/40">
              Vienen activadas: te avisamos de fotos nuevas, música, tareas y
              mensajes del chat. Puedes apagarlas aquí cuando quieras.
            </p>
            <AvisosPush />
          </div>

          <form action={cerrarSesion} className="mt-8">
            <button
              type="submit"
              className="inline-flex min-h-[48px] cursor-pointer items-center gap-2 rounded-full border border-white/25 px-5 text-sm transition-colors duration-200 hover:bg-white/10"
            >
              <LogOut size={16} aria-hidden="true" />
              Cerrar sesión
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
