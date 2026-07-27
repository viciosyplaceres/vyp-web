import Image from "next/image";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  Play,
  Music,
  Check,
  ClipboardList,
  ShoppingCart,
  Shirt,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSesion } from "@/lib/auth";
import { aplanarRelacion } from "@/lib/relaciones";
import { diaLegible } from "@/lib/formato";
import { obtenerAnioActivo } from "@/app/actions/configuracion";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Perfil",
  robots: { index: false, follow: false },
};

export default async function PerfilPublicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sesion = await getSesion();
  if (!sesion) redirect(`/login?next=/miembros/${id}`);
  if (!sesion.esMiembro) redirect("/perfil");

  const supabase = await createClient();

  // Mismo motivo que en /miembros: RLS solo deja ver el perfil propio.
  const { data: perfil } = await createAdminClient()
    .from("perfiles")
    .select("id, nombre, usuario, avatar_url, bio, rol, aprobado")
    .eq("id", id)
    .eq("aprobado", true)
    .maybeSingle();

  if (!perfil) notFound();

  const esYoMismo = perfil.id === sesion.userId;

  const anio = await obtenerAnioActivo();

  const [
    { data: fotos },
    { data: pistas },
    { data: filasTareas },
    { data: filasCompra },
    { data: pedido },
    { data: pago },
  ] = await Promise.all([
      supabase
        .from("media")
        .select("id, anio, tipo, url, thumb_url, descripcion")
        .eq("subido_por", id)
        .order("created_at", { ascending: false })
        .limit(9),
      supabase
        .from("pistas")
        .select("id, titulo, artista, tipo")
        .eq("subido_por", id)
        .order("created_at", { ascending: false })
        .limit(9),
      // `tareas`/`tareas_miembros` sí son legibles para cualquier miembro
      // (a diferencia de `perfiles`): es la organización de la peña, no algo
      // privado de cada uno. No hace falta el cliente de servicio aquí.
      supabase
        .from("tareas_miembros")
        .select("tareas(id, titulo, fecha, hecha)")
        .eq("perfil_id", id),
      supabase
        .from("compra_miembros")
        .select("lista_compra(id, item, cantidad, comprado, anio)")
        .eq("perfil_id", id),
      supabase
        .from("pedidos_camiseta")
        .select("tallas")
        .eq("perfil_id", id)
        .eq("anio", anio)
        .maybeSingle(),
      supabase
        .from("pagos")
        .select("pagado")
        .eq("perfil_id", id)
        .eq("anio", anio)
        .maybeSingle(),
    ]);

  const tallas: string[] = pedido?.tallas ?? [];
  const haPagado = pago?.pagado ?? false;

  type SuTarea = { id: string; titulo: string; fecha: string | null; hecha: boolean };
  type SuCompra = { id: string; item: string; cantidad: number; comprado: boolean; anio: number };

  const tareas = aplanarRelacion<SuTarea>(filasTareas, "tareas").sort((a, b) =>
    (a.fecha ?? "9999").localeCompare(b.fecha ?? "9999"),
  );
  const compras = aplanarRelacion<SuCompra>(filasCompra, "lista_compra");

  return (
    <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl space-y-10">
        <div>
          <Link
            href="/miembros"
            className="mb-5 inline-flex cursor-pointer items-center gap-1.5 text-sm text-white/50 transition-colors duration-200 hover:text-white"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            Miembros
          </Link>

          <div className="flex items-center gap-4">
            <Avatar nombre={perfil.nombre} avatarUrl={perfil.avatar_url} tamano={72} />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold">
                {perfil.nombre || "(sin nombre)"}
                {esYoMismo && <span className="text-white/40"> (tú)</span>}
              </h1>
              {perfil.usuario && (
                <p className="truncate text-sm text-white/50">@{perfil.usuario}</p>
              )}
              <p className="text-xs text-white/40">
                {perfil.rol === "admin" ? "Directiva" : "Miembro"} de la peña
              </p>
            </div>
          </div>

          {perfil.bio && (
            <p className="mt-4 whitespace-pre-wrap text-sm text-white/70">
              {perfil.bio}
            </p>
          )}
        </div>

        <section className="grid gap-2 border-t border-white/10 pt-8 sm:grid-cols-2">
          <div className="rounded-lg border border-white/10 px-4 py-3">
            <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40">
              <Shirt size={14} aria-hidden="true" />
              Camisetas {anio}
            </p>
            <p className="mt-1.5 text-sm">
              {tallas.length === 0 ? (
                <span className="text-white/50">No ha pedido ninguna.</span>
              ) : (
                <>
                  <span className="font-semibold tabular-nums">{tallas.length}</span>{" "}
                  · <span className="text-white/70">{tallas.join(", ")}</span>
                </>
              )}
            </p>
          </div>

          <div className="rounded-lg border border-white/10 px-4 py-3">
            <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40">
              <Wallet size={14} aria-hidden="true" />
              Cuota {anio}
            </p>
            <p className="mt-1.5 text-sm">
              {haPagado ? (
                <span className="font-medium text-white">Pagada</span>
              ) : (
                <span className="text-white/60">Pendiente</span>
              )}
            </p>
          </div>
        </section>

        <section className="border-t border-white/10 pt-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ClipboardList size={18} className="text-white/50" aria-hidden="true" />
            Tareas asignadas
          </h2>
          {tareas.length === 0 ? (
            <p className="mt-2 text-sm text-white/40">No tiene ninguna tarea asignada.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {tareas.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5"
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                      t.hecha ? "border-white bg-white text-black" : "border-white/30 text-transparent"
                    }`}
                  >
                    <Check size={14} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${t.hecha ? "text-white/40 line-through" : ""}`}>
                      {t.titulo}
                    </p>
                    {t.fecha && (
                      <p className="text-xs text-white/50 tabular-nums">
                        {diaLegible(t.fecha)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border-t border-white/10 pt-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ShoppingCart size={18} className="text-white/50" aria-hidden="true" />
            Compra asignada
          </h2>
          {compras.length === 0 ? (
            <p className="mt-2 text-sm text-white/40">No tiene nada asignado de la compra.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {compras.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5"
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                      c.comprado ? "border-white bg-white text-black" : "border-white/30 text-transparent"
                    }`}
                  >
                    <Check size={14} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${c.comprado ? "text-white/40 line-through" : ""}`}>
                      {c.item}
                    </p>
                    <p className="text-xs text-white/50">
                      {c.cantidad > 1 && `Cantidad: ${c.cantidad} · `}
                      <span className="tabular-nums">{c.anio}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border-t border-white/10 pt-8">
          <h2 className="text-lg font-semibold">Fotos y vídeos</h2>
          {!fotos?.length ? (
            <p className="mt-2 text-sm text-white/40">Todavía no ha subido nada.</p>
          ) : (
            <ul className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2">
              {fotos.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/galeria/${f.anio}/${f.id}`}
                    className="group relative block aspect-square cursor-pointer overflow-hidden rounded-md bg-white/5"
                  >
                    <Image
                      src={f.thumb_url || f.url}
                      alt={f.descripcion || `Foto de ${f.anio}`}
                      fill
                      sizes="(max-width: 640px) 33vw, 25vw"
                      className="object-cover transition-opacity duration-200 group-hover:opacity-80"
                    />
                    {f.tipo === "video" && (
                      <span className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70">
                        <Play size={12} className="ml-0.5" aria-hidden="true" />
                        <span className="sr-only">Vídeo</span>
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border-t border-white/10 pt-8">
          <h2 className="text-lg font-semibold">Música</h2>
          {!pistas?.length ? (
            <p className="mt-2 text-sm text-white/40">Todavía no ha subido música.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {pistas.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5"
                >
                  <Music size={16} className="shrink-0 text-white/40" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.titulo}</p>
                    <p className="truncate text-xs text-white/50">
                      {[p.artista, p.tipo === "sesion" ? "Sesión" : "Canción"]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
