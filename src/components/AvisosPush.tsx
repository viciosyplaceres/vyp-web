"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

/** Convierte la clave pública VAPID (base64url) al formato que espera el navegador. */
function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normal);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function AvisosPush() {
  const [soportado, setSoportado] = useState(false);
  const [activo, setActivo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    const ok =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    if (!ok) return;

    // El estado se fija dentro de la promesa, no en el cuerpo del efecto:
    // así no se encadenan renders innecesarios.
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        setSoportado(true);
        setActivo(Boolean(sub));
      })
      .catch(() => undefined);
  }, []);

  async function activar() {
    setOcupado(true);
    setAviso(null);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setAviso("Has bloqueado las notificaciones en este navegador.");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        ),
      });

      const res = await fetch("/api/push/suscribir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });

      if (!res.ok) throw new Error("No se pudo guardar la suscripción.");
      setActivo(true);
    } catch {
      setAviso("No se pudieron activar los avisos.");
    } finally {
      setOcupado(false);
    }
  }

  async function desactivar() {
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/suscribir", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setActivo(false);
    } catch {
      setAviso("No se pudieron desactivar los avisos.");
    } finally {
      setOcupado(false);
    }
  }

  if (!soportado) return null;

  return (
    <div className="border-b border-white/10 pb-3">
      <button
        type="button"
        onClick={activo ? desactivar : activar}
        disabled={ocupado}
        className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-white/60 transition-colors duration-200 hover:text-white disabled:opacity-50"
      >
        {activo ? (
          <BellOff size={16} aria-hidden="true" />
        ) : (
          <Bell size={16} aria-hidden="true" />
        )}
        {ocupado
          ? "Un momento…"
          : activo
            ? "Avisos activados · desactivar"
            : "Activar avisos en este móvil"}
      </button>
      {aviso && (
        <p role="alert" className="text-xs text-red-400">
          {aviso}
        </p>
      )}
    </div>
  );
}
