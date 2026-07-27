"use client";

import { useEffect } from "react";

/** Registra el service worker que hace de la web una PWA instalable. */
export default function RegistrarSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const registrar = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Si falla, la web sigue funcionando como web normal.
      });
    };
    if (document.readyState === "complete") registrar();
    else window.addEventListener("load", registrar);
    return () => window.removeEventListener("load", registrar);
  }, []);

  return null;
}
