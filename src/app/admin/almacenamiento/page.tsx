import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { obtenerUsoCloudinary, obtenerUsoR2 } from "@/lib/almacenamiento";
import PanelAlmacenamiento, {
  type MediaConTamano,
  type PistaConTamano,
} from "@/components/PanelAlmacenamiento";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Almacenamiento",
  robots: { index: false, follow: false },
};

export default async function AlmacenamientoPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/login?next=/admin/almacenamiento");

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

  const [usoCloudinary, usoR2, { data: media }, { data: pistas }] =
    await Promise.all([
      obtenerUsoCloudinary().catch(() => null),
      obtenerUsoR2().catch(() => null),
      supabase
        .from("media")
        .select("id, tipo, anio, storage_id, descripcion, bytes")
        .order("bytes", { ascending: false, nullsFirst: false }),
      supabase
        .from("pistas")
        .select("id, titulo, origen, url, bytes")
        .eq("origen", "r2")
        .order("bytes", { ascending: false, nullsFirst: false }),
    ]);

  return (
    <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold sm:text-3xl">Almacenamiento</h1>
        <p className="mt-1 text-sm text-white/50">
          Para no pasarnos nunca de las cuentas gratuitas. Las subidas se
          bloquean solas al llegar al 90%.
        </p>

        {!usoCloudinary && !usoR2 ? (
          <p className="mt-6 text-sm text-red-400">
            No se pudo consultar el uso ahora mismo. Reinténtalo en un momento.
          </p>
        ) : (
          <PanelAlmacenamiento
            cloudinaryPorcentaje={usoCloudinary?.porcentaje ?? 0}
            cloudinayDetalle={
              usoCloudinary
                ? `${usoCloudinary.creditosUsados.toFixed(2)} / ${usoCloudinary.creditosLimite} créditos`
                : "sin datos"
            }
            cloudinaryBloqueado={usoCloudinary?.bloqueado ?? false}
            r2Porcentaje={usoR2?.porcentaje ?? 0}
            r2Detalle={
              usoR2
                ? `${(usoR2.bytesUsados / (1024 * 1024 * 1024)).toFixed(2)} / ${(usoR2.bytesLimite / (1024 * 1024 * 1024)).toFixed(0)} GB`
                : "sin datos"
            }
            r2Bloqueado={usoR2?.bloqueado ?? false}
            media={(media ?? []) as MediaConTamano[]}
            pistas={(pistas ?? []) as PistaConTamano[]}
          />
        )}
      </div>
    </main>
  );
}
