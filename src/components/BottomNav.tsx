"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Images,
  Music,
  MessageCircle,
  Settings,
  User,
} from "lucide-react";

type Item = {
  href: string;
  etiqueta: string;
  Icono: typeof Home;
};

export default function BottomNav({
  esMiembro,
  esAdmin,
  haySesion,
}: {
  esMiembro: boolean;
  esAdmin: boolean;
  haySesion: boolean;
}) {
  const pathname = usePathname();

  const items: Item[] = [
    { href: "/", etiqueta: "Inicio", Icono: Home },
    { href: "/galeria", etiqueta: "Galería", Icono: Images },
    { href: "/musica", etiqueta: "Música", Icono: Music },
  ];

  if (esMiembro) {
    items.push({ href: "/chat", etiqueta: "Chat", Icono: MessageCircle });
  }

  if (esAdmin) {
    items.push({ href: "/admin", etiqueta: "Gestión", Icono: Settings });
  }

  items.push({
    href: haySesion ? "/perfil" : "/login",
    etiqueta: haySesion ? "Perfil" : "Acceder",
    Icono: User,
  });

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex items-stretch justify-around">
        {items.map(({ href, etiqueta, Icono }) => {
          const activo =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={activo ? "page" : undefined}
                className={`flex min-h-[56px] cursor-pointer flex-col items-center justify-center gap-1 px-1 py-2 transition-colors duration-200 ${
                  activo ? "text-white" : "text-white/50 hover:text-white/80"
                }`}
              >
                <Icono
                  size={22}
                  strokeWidth={activo ? 2.2 : 1.8}
                  aria-hidden="true"
                />
                <span className="text-[11px] leading-none tracking-wide">
                  {etiqueta}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
