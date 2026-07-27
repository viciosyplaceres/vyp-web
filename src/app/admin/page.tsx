import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ShoppingCart, Users, ListChecks, UserRound, Coins, HardDrive } from "lucide-react";
import { getSesion } from "@/lib/auth";
import { obtenerAnioActivo } from "@/app/actions/configuracion";
import SelectorAnioActivo from "@/components/SelectorAnioActivo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gestión",
  robots: { index: false, follow: false },
};

const SECCIONES = [
  { href: "/admin/participantes", texto: "Participantes", Icono: UserRound },
  { href: "/admin/deudas", texto: "Deudas", Icono: Coins },
  { href: "/admin/tareas", texto: "Tareas", Icono: ListChecks },
  { href: "/admin/compras", texto: "Lista de la compra", Icono: ShoppingCart },
  { href: "/admin/miembros", texto: "Miembros", Icono: Users },
  { href: "/admin/almacenamiento", texto: "Almacenamiento", Icono: HardDrive },
];

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

  const anioActivo = await obtenerAnioActivo();

  return (
    <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold sm:text-3xl">Gestión</h1>

        <div className="mt-6">
          <SelectorAnioActivo anioActivo={anioActivo} />
        </div>

        <ul className="grid gap-2 sm:grid-cols-2">
          {SECCIONES.map(({ href, texto, Icono }) => (
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
      </div>
    </main>
  );
}
