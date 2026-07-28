"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Images, Music, MessageCircle, Users, Settings } from "lucide-react";
import type { Escucha } from "@/lib/realtime";

type Item = {
  href: string;
  etiqueta: string;
  Icono: typeof Home;
};

const ESCUCHAS: Escucha[] = [
  { tabla: "mensajes", evento: "INSERT" },
  { tabla: "mensajes", evento: "DELETE" },
];

export default function BottomNav({
  esMiembro,
  userId,
  noLeidosInicial,
}: {
  esMiembro: boolean;
  userId: string | null;
  noLeidosInicial: number;
}) {
  const pathname = usePathname();
  const enChat = pathname.startsWith("/chat");
  const [noLeidos, setNoLeidos] = useState(noLeidosInicial);
  // Entrar al chat cuenta como leído al instante en la propia interfaz, sin
  // esperar a la respuesta del servidor. El enlace vacía también el estado:
  // limitarse a ocultarlo mientras estamos en /chat hacía que reapareciera al
  // navegar fuera aunque la marca de lectura ya se hubiera guardado.
  const mostrado = enChat ? 0 : noLeidos;

  // Estar o no en el chat se lee dentro del callback, no como dependencia:
  // así navegar a /chat y volver no rehace la suscripción.
  const enChatRef = useRef(enChat);
  useEffect(() => {
    enChatRef.current = enChat;
  }, [enChat]);

  // Burbuja en vivo: un mensaje nuevo de otro miembro la sube. Con el chat
  // abierto no hay nada que hacer: el propio chat marca la conversación como
  // leída (antes lo hacían los dos, duplicando la escritura) y la burbuja ya
  // se pinta en cero.
  useEffect(() => {
    if (!esMiembro || !userId) return;

    let cancelado = false;
    let darDeBaja: (() => void) | undefined;
    void import("@/lib/realtime")
      .then(({ suscribirRealtime }) => {
        if (cancelado) return;
        darDeBaja = suscribirRealtime(ESCUCHAS, (escucha, cambio) => {
          if (escucha.evento === "DELETE") {
            setNoLeidos(0);
            return;
          }
          const mensaje = cambio.new as { autor_id?: string } | null;
          if (!mensaje?.autor_id || mensaje.autor_id === userId) return;
          if (enChatRef.current) return;
          setNoLeidos((cantidad) => cantidad + 1);
        });
      })
      .catch(() => undefined);

    return () => {
      cancelado = true;
      darDeBaja?.();
    };
  }, [esMiembro, userId]);

  const items: Item[] = [
    { href: "/", etiqueta: "Inicio", Icono: Home },
    { href: "/galeria", etiqueta: "Galería", Icono: Images },
    { href: "/musica", etiqueta: "Música", Icono: Music },
  ];

  if (esMiembro) {
    items.push({ href: "/chat", etiqueta: "Chat", Icono: MessageCircle });
    // El directorio (`/miembros`) solo tenía enlace en el nav de escritorio
    // (`Header.tsx`, oculto en móvil): en el móvil —el uso principal de la
    // app— no había ninguna forma de llegar ahí salvo escribiendo la URL
    // a mano. Es de cualquier miembro, no solo de la directiva.
    items.push({ href: "/miembros", etiqueta: "Miembros", Icono: Users });
    // Organizar las fiestas es cosa de toda la peña, no solo de la junta:
    // dentro de Gestión ya se distingue lo que es exclusivo de la directiva.
    items.push({ href: "/admin", etiqueta: "Gestión", Icono: Settings });
  }

  // El perfil ya se abre desde el avatar del header (visible en todas las
  // pantallas, incluido móvil): repetirlo aquí sería redundante.

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex items-stretch justify-around">
        {items.map(({ href, etiqueta, Icono }) => {
          const activo =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          const esChat = href === "/chat";

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                onClick={esChat ? () => setNoLeidos(0) : undefined}
                aria-current={activo ? "page" : undefined}
                className={`relative flex min-h-[56px] cursor-pointer flex-col items-center justify-center gap-1 px-1 py-2 transition-colors duration-200 ${
                  activo ? "text-white" : "text-white/50 hover:text-white/80"
                }`}
              >
                <span className="relative">
                  <Icono size={22} strokeWidth={activo ? 2.2 : 1.8} aria-hidden="true" />
                  {esChat && mostrado > 0 && (
                    <span
                      aria-label={`${mostrado} mensajes sin leer`}
                      className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white"
                    >
                      {mostrado > 99 ? "99+" : mostrado}
                    </span>
                  )}
                </span>
                <span className="text-[11px] leading-none tracking-wide">{etiqueta}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
