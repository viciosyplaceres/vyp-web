import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  ShoppingCart,
  Users,
  ListChecks,
  Shirt,
  Wallet,
  Coins,
  Sparkles,
  HardDrive,
} from "lucide-react";
import { getSesion } from "@/lib/auth";
import { obtenerAnioActivo } from "@/app/actions/configuracion";
import SelectorAnioActivo from "@/components/SelectorAnioActivo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gestión",
  robots: { index: false, follow: false },
};

// Organizar las fiestas lo hace la peña entera, así que la gestión la ve
// cualquier miembro aprobado. Lo que sigue siendo solo de la directiva son las
// dos cosas que de verdad lo son: dar de alta o echar gente, y borrar
// archivos del almacenamiento.
const SECCIONES_MIEMBRO = [
  { href: "/admin/camisetas", texto: "Camisetas", Icono: Shirt },
  { href: "/admin/pagos", texto: "Pagos", Icono: Wallet },
  { href: "/admin/tareas", texto: "Tareas", Icono: ListChecks },
  { href: "/admin/limpieza", texto: "Limpieza", Icono: Sparkles },
  { href: "/admin/compras", texto: "Lista de la compra", Icono: ShoppingCart },
  { href: "/admin/deudas", texto: "Deudas", Icono: Coins },
];

const SECCIONES_DIRECTIVA = [
  { href: "/admin/miembros", texto: "Miembros", Icono: Users },
  { href: "/admin/almacenamiento", texto: "Almacenamiento", Icono: HardDrive },
];

export default async function AdminPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/login?next=/admin");

  if (!sesion.esMiembro) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16 text-center">
        <p className="max-w-sm text-white/60">
          Tu cuenta todavía está pendiente de que la directiva la apruebe.
          Cuando te aprueben, la gestión se abre sola.
        </p>
      </main>
    );
  }

  const anioActivo = await obtenerAnioActivo();

  return (
    <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold sm:text-3xl">Gestión</h1>

        {sesion.esAdmin ? (
          <div className="mt-6">
            <SelectorAnioActivo anioActivo={anioActivo} />
          </div>
        ) : (
          <p className="mt-2 mb-6 text-sm text-white/50 tabular-nums">
            Fiestas de {anioActivo}
          </p>
        )}

        <ul className="grid gap-2 sm:grid-cols-2">
          {SECCIONES_MIEMBRO.map(({ href, texto, Icono }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex min-h-[56px] cursor-pointer items-center gap-3 rounded-lg border border-white/15 px-4 transition-colors duration-200 hover:bg-white/5"
              >
                <Icono size={18} className="text-white/60" aria-hidden="true" />
                {texto}
              </Link>
            </li>
          ))}
        </ul>

        {sesion.esAdmin && (
          <>
            <h2 className="mt-8 mb-3 text-sm uppercase tracking-wider text-white/40">
              Solo la directiva
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {SECCIONES_DIRECTIVA.map(({ href, texto, Icono }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="flex min-h-[56px] cursor-pointer items-center gap-3 rounded-lg border border-white/15 px-4 transition-colors duration-200 hover:bg-white/5"
                  >
                    <Icono size={18} className="text-white/60" aria-hidden="true" />
                    {texto}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
