import Image from "next/image";
import Link from "next/link";
import type { Sesion } from "@/lib/auth";
import AvatarPendientes from "@/components/AvatarPendientes";

/** Enlaces solo para pantallas grandes: en móvil manda la barra inferior. */
const ENLACES = [
  { href: "/galeria", texto: "Galería" },
  { href: "/musica", texto: "Música" },
  { href: "/#donde", texto: "Dónde" },
];

export default function Header({
  sesion,
  pendientesInicial,
}: {
  sesion: Sesion | null;
  pendientesInicial: number;
}) {
  return (
    <header className="sticky top-0 z-40 shrink-0 border-b border-white/10 bg-black/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center">
          <Image
            src="/logo/vyp-wordmark.png"
            alt="Vicios & Placeres"
            width={1886}
            height={182}
            priority
            sizes="(min-width: 640px) 497px, calc(100vw - 32px)"
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
            <>
              <Link
                href="/chat"
                className="cursor-pointer text-white/60 transition-colors duration-200 hover:text-white"
              >
                Chat
              </Link>
              <Link
                href="/miembros"
                className="cursor-pointer text-white/60 transition-colors duration-200 hover:text-white"
              >
                Miembros
              </Link>
              <Link
                href="/admin"
                className="cursor-pointer text-white/60 transition-colors duration-200 hover:text-white"
              >
                Gestión
              </Link>
            </>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-3 text-sm">
          {sesion ? (
            <AvatarPendientes
              nombre={sesion.nombre}
              usuario={sesion.usuario}
              avatarUrl={sesion.avatarUrl}
              userId={sesion.userId}
              esMiembro={sesion.esMiembro}
              pendientesInicial={pendientesInicial}
            />
          ) : (
            <Link
              href="/login"
              className="cursor-pointer text-white/60 transition-colors duration-200 hover:text-white"
            >
              Acceder
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
