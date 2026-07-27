import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Upload, MessageCircle, LogOut, MapPin } from "lucide-react";
import { getSesion } from "@/lib/auth";
import { cerrarSesion } from "@/app/actions/auth";
import AvisosPush from "@/components/AvisosPush";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mi cuenta",
  robots: { index: false, follow: false },
};

export default async function CuentaPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/login?next=/cuenta");

  return (
    <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-semibold">
          {sesion.nombre ?? "Mi cuenta"}
        </h1>
        <p className="mt-1 text-sm text-white/50">
          {sesion.esAdmin
            ? "Directiva de la peña"
            : sesion.esMiembro
              ? "Miembro de la peña"
              : "Cuenta pendiente de aprobación"}
        </p>

        {!sesion.esMiembro && (
          <p className="mt-4 rounded-lg border border-white/15 p-4 text-sm text-white/60">
            La directiva tiene que aprobar tu cuenta antes de que puedas subir
            fotos, comentar o entrar en el chat. Mientras tanto puedes ver la
            galería y escuchar la música.
          </p>
        )}

        {sesion.esMiembro && (
          <>
            <div className="mt-6">
              <AvisosPush />
            </div>

            <nav className="mt-6 space-y-2">
              <Link
                href="/subir"
                className="flex min-h-[56px] cursor-pointer items-center gap-3 rounded-lg border border-white/15 px-4 transition-colors duration-200 hover:bg-white/5"
              >
                <Upload size={18} className="text-white/60" aria-hidden="true" />
                Subir fotos o música
              </Link>
              <Link
                href="/chat"
                className="flex min-h-[56px] cursor-pointer items-center gap-3 rounded-lg border border-white/15 px-4 transition-colors duration-200 hover:bg-white/5"
              >
                <MessageCircle
                  size={18}
                  className="text-white/60"
                  aria-hidden="true"
                />
                Chat de la peña
              </Link>
              <Link
                href="/#donde"
                className="flex min-h-[56px] cursor-pointer items-center gap-3 rounded-lg border border-white/15 px-4 transition-colors duration-200 hover:bg-white/5"
              >
                <MapPin size={18} className="text-white/60" aria-hidden="true" />
                Dónde estamos
              </Link>
            </nav>
          </>
        )}

        <form action={cerrarSesion} className="mt-8">
          <button
            type="submit"
            className="inline-flex min-h-[48px] cursor-pointer items-center gap-2 rounded-full border border-white/25 px-5 text-sm transition-colors duration-200 hover:bg-white/10"
          >
            <LogOut size={16} aria-hidden="true" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </main>
  );
}
