"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, X, Share, Plus } from "lucide-react";

/** Evento propio de Chrome/Edge (no está en los tipos estándar). */
type EventoInstalacion = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const OCULTAR_HASTA = "vyp-instalar-oculto-hasta";

declare global {
  interface Window {
    __vypInstallEvent?: EventoInstalacion;
  }
}

function estaInstalada() {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari en iPhone usa su propia propiedad
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function esIOS() {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPad moderno se identifica como Mac con pantalla táctil
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Cartel de "instala la app", pensado para gente que no es de tecnología:
 * ocupa la pantalla, explica para qué sirve y solo tiene un botón grande.
 *
 * En Android/Chrome usa el instalador nativo del navegador (un toque y ya).
 * En iPhone no existe ese instalador, así que se enseñan los dos pasos con
 * dibujos de los iconos reales que verá en su móvil.
 */
export default function InstalarApp() {
  const [evento, setEvento] = useState<EventoInstalacion | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (estaInstalada()) return;

    // Si lo cerró hace poco, no dar la lata en cada visita.
    const hasta = Number(localStorage.getItem(OCULTAR_HASTA) ?? 0);
    if (Date.now() < hasta) return;

    const enIOS = esIOS();

    const alPoderInstalar = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalacion);
      setVisible(true);
    };

    const alEventoYaCapturado = () => {
      if (window.__vypInstallEvent) {
        setEvento(window.__vypInstallEvent);
        setVisible(true);
      }
    };

    window.addEventListener("beforeinstallprompt", alPoderInstalar);
    window.addEventListener("vyp-install-ready", alEventoYaCapturado);

    // Puede que el evento ya haya llegado antes de montar este componente
    // (capturado por el script del <head>). Se comprueba en un microtask, no
    // en el cuerpo del efecto, para no encadenar renders de forma síncrona.
    queueMicrotask(alEventoYaCapturado);

    // En iPhone el evento anterior no existe nunca: se enseña la guía manual.
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    if (enIOS) {
      temporizador = setTimeout(() => {
        setIos(true);
        setVisible(true);
      }, 1500);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", alPoderInstalar);
      window.removeEventListener("vyp-install-ready", alEventoYaCapturado);
      if (temporizador) clearTimeout(temporizador);
    };
  }, []);

  function cerrar() {
    // Una semana de tregua.
    localStorage.setItem(
      OCULTAR_HASTA,
      String(Date.now() + 7 * 24 * 60 * 60 * 1000),
    );
    setVisible(false);
  }

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    if (outcome === "accepted") setVisible(false);
    else cerrar();
    setEvento(null);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-instalar"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-neutral-950 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6">
        <div className="flex items-start justify-between gap-4">
          <Image
            src="/logo/vyp-icon-192.png"
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-xl border border-white/10"
          />
          <button
            type="button"
            onClick={cerrar}
            aria-label="Ahora no"
            className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/40 transition-colors duration-200 hover:text-white"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <h2 id="titulo-instalar" className="mt-4 text-xl font-semibold">
          Instala la app de la peña
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/60">
          Se añade al móvil como cualquier otra app, se abre más rápido y te
          avisa cuando alguien sube fotos o escribe en el chat.
        </p>

        {ios ? (
          <div className="mt-5 space-y-3">
            <p className="text-sm font-medium">Son dos pasos:</p>
            <ol className="space-y-3 text-sm text-white/70">
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
                  1
                </span>
                <span className="flex items-center gap-1.5">
                  Pulsa
                  <Share size={16} className="text-white" aria-hidden="true" />
                  <span className="text-white">Compartir</span>, abajo del todo
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
                  2
                </span>
                <span className="flex items-center gap-1.5">
                  Elige
                  <Plus size={16} className="text-white" aria-hidden="true" />
                  <span className="text-white">Añadir a inicio</span>
                </span>
              </li>
            </ol>
            <button
              type="button"
              onClick={cerrar}
              className="mt-2 min-h-[48px] w-full cursor-pointer rounded-full border border-white/25 px-6 text-sm font-medium transition-colors duration-200 hover:bg-white/10"
            >
              Entendido
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={instalar}
              className="mt-5 inline-flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-6 text-base font-semibold text-black transition-opacity duration-200 hover:opacity-85"
            >
              <Download size={20} aria-hidden="true" />
              Instalar la app
            </button>
            <button
              type="button"
              onClick={cerrar}
              className="mt-2 min-h-[44px] w-full cursor-pointer text-sm text-white/40 transition-colors duration-200 hover:text-white"
            >
              Ahora no
            </button>
          </>
        )}
      </div>
    </div>
  );
}
