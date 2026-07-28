"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { urlBase64ToUint8Array } from "@/lib/push-cliente";

/**
 * Ofrece activar los avisos a cualquier miembro conectado.
 *
 * Chrome y Safari solo muestran el permiso tras un gesto explícito. El botón
 * evita depender de que la web esté instalada como PWA para poder suscribir el
 * dispositivo y recibir avisos.
 */
export default function ActivarAvisosAuto({
  haySesion,
}: {
  haySesion: boolean;
}) {
  const [mostrarBoton, setMostrarBoton] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const respuesta = await fetch("/api/push/suscribir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub),
    });
    if (!respuesta.ok) throw new Error("No se pudo guardar la suscripción.");
  }, []);

  const pedirPermiso = useCallback(async () => {
    setOcupado(true);
    setError(null);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso === "granted") {
        await suscribir();
        setMostrarBoton(false);
      } else if (permiso === "denied") {
        // Denegado: el navegador no permitirá volver a preguntar.
        localStorage.setItem("vyp-avisos-intentado", "1");
        setMostrarBoton(false);
      } else {
        // Si se cerró el diálogo, se mantiene el botón para poder intentarlo
        // de nuevo con un gesto explícito.
        setMostrarBoton(true);
      }
    } catch {
      setError("No se han podido activar los avisos. Vuelve a intentarlo.");
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

    (async () => {
      if (Notification.permission === "granted") {
        // Ya concedido: asegurar que este dispositivo está registrado en el
        // servidor (puede haberse reinstalado la app o caducado la suscripción).
        await suscribir().catch(() => undefined);
        return;
      }

      if (Notification.permission === "default") {
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
          Para enterarte cuando suban fotos o escriban en el chat. Te pedirá
          permiso al tocar el botón.
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
        {error && (
          <p role="alert" className="mt-2 text-xs text-red-400">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
