"use client";

import { lazy, startTransition, Suspense, useEffect, useState } from "react";

const RegistrarSW = lazy(() => import("@/components/RegistrarSW"));
const InstalarApp = lazy(() => import("@/components/InstalarApp"));
const ActivarAvisosAuto = lazy(() => import("@/components/ActivarAvisosAuto"));
const RETRASO_PWA_MS = 8_000;

export default function ComplementosPWA({ haySesion }: { haySesion: boolean }) {
  const [listos, setListos] = useState(false);

  useEffect(() => {
    const temporizador = setTimeout(() => {
      startTransition(() => setListos(true));
    }, RETRASO_PWA_MS);
    return () => clearTimeout(temporizador);
  }, []);

  if (!listos) return null;

  return (
    <Suspense fallback={null}>
      <RegistrarSW />
      <InstalarApp />
      <ActivarAvisosAuto haySesion={haySesion} />
    </Suspense>
  );
}
