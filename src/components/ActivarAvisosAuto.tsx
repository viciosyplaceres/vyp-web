"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { urlBase64ToUint8Array } from "@/lib/push-cliente";

/**
 * Deja los avisos activados sin que el usuario tenga que buscar nada.
 *
 * Al abrir la app instalada, si todavía no se ha decidido el permiso, se pide
 * directamente: en Android el teléfono muestra su ventana de permisos ahí
 * mismo. Safari en iPhone exige que el usuario toque algo antes de poder
 * pedirlo, así que en ese caso (y si el intento automático falla por lo que
 * sea) aparece un cartel con un botón grande que hace lo mismo.
 *
 * Solo se intenta una vez por dispositivo: si alguien dice que no, no se le
 * vuelve a insistir — entre otras cosas porque el navegador ya no dejaría
 * volver a preguntar.
 */
export default function ActivarAvisosAuto({
  haySesion,
}: {
  haySesion: boolean;
}) {
  const [mostrarBoton, setMostrarBoton] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const suscribir = useCallback(async () => {
    const reg = await navigator.serviceWorker.ready;

    const existente = await reg.pushManager.getSubscription();
    const sub =
      existente ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        ),
      }));

    await fetch("/api/push/suscribir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub),
    });
  }, []);

  const pedirPermiso = useCallback(async () => {
    setOcupado(true);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso === "granted") {
        await suscribir();
        setMostrarBoton(false);
      } else {
        // Denegado: el navegador no permitirá volver a preguntar.
        localStorage.setItem("vyp-avisos-intentado", "1");
        setMostrarBoton(false);
      }
    } catch {
      setMostrarBoton(true);
    } finally {
      setOcupado(false);
    }
  }, [suscribir]);

  useEffect(() => {
    if (!haySesion) return;
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      return;
    }

    const enApp =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;

    // Fuera de la app instalada no se molesta: ahí está el botón de /perfil.
    if (!enApp) return;

    (async () => {
      if (Notification.permission === "granted") {
        // Ya concedido: asegurar que este dispositivo está registrado en el
        // servidor (puede haberse reinstalado la app o caducado la suscripción).
        await suscribir().catch(() => undefined);
        return;
      }

      if (Notification.permission === "denied") return;
      if (localStorage.getItem("vyp-avisos-intentado")) return;

      localStorage.setItem("vyp-avisos-intentado", "1");

      try {
        const permiso = await Notification.requestPermission();
        if (permiso === "granted") await suscribir();
      } catch {
        // Safari exige un gesto del usuario: se enseña el botón.
        setMostrarBoton(true);
      }
    })();
  }, [haySesion, suscribir]);

  if (!mostrarBoton) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-50 mx-auto max-w-sm px-4 md:bottom-6">
      <div className="rounded-2xl border border-white/15 bg-neutral-950 p-4 shadow-lg">
        <p className="text-sm font-medium">Activa los avisos</p>
        <p className="mt-1 text-xs text-white/60">
          Para enterarte cuando suban fotos o escriban en el chat.
        </p>
        <button
          type="button"
          onClick={pedirPermiso}
          disabled={ocupado}
          className="mt-3 inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black transition-opacity duration-200 hover:opacity-85 disabled:opacity-50"
        >
          <Bell size={18} aria-hidden="true" />
          {ocupado ? "Un momento…" : "Activar avisos"}
        </button>
      </div>
    </div>
  );
}
