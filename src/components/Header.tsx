import Image from "next/image";
import Link from "next/link";
import { getSesion } from "@/lib/auth";
import { cerrarSesion } from "@/app/actions/auth";

/** Enlaces solo para pantallas grandes: en móvil manda la barra inferior. */
const ENLACES = [
  { href: "/galeria", texto: "Galería" },
  { href: "/musica", texto: "Música" },
  { href: "/donde", texto: "Dónde" },
];

export default async function Header() {
  const sesion = await getSesion();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center">
          <Image
            src="/logo/vyp-wordmark.png"
            alt="Vicios & Placeres"
            width={1886}
            height={182}
            priority
            className="h-5 w-auto sm:h-6"
          />
        </Link>

        <nav className="hidden items-center gap-6 text-sm md:flex">
          {ENLACES.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              className="cursor-pointer text-white/60 transition-colors duration-200 hover:text-white"
            >
              {e.texto}
            </Link>
          ))}
          {sesion?.esMiembro && (
            <Link
              href="/chat"
              className="cursor-pointer text-white/60 transition-colors duration-200 hover:text-white"
            >
              Chat
            </Link>
          )}
          {sesion?.esAdmin && (
            <Link
              href="/admin"
              className="cursor-pointer text-white/60 transition-colors duration-200 hover:text-white"
            >
              Gestión
            </Link>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-3 text-sm">
          {sesion?.esMiembro && (
            <Link
              href="/subir"
              className="cursor-pointer rounded-full bg-white px-3 py-1.5 text-xs font-medium text-black transition-opacity duration-200 hover:opacity-85 sm:text-sm"
            >
              Subir
            </Link>
          )}
          {sesion ? (
            <form action={cerrarSesion}>
              <button
                type="submit"
                className="cursor-pointer text-white/60 transition-colors duration-200 hover:text-white"
              >
                Salir
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="hidden cursor-pointer text-white/60 transition-colors duration-200 hover:text-white md:block"
            >
              Acceder
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
