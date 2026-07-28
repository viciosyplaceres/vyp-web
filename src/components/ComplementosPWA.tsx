"use client";

import { lazy, Suspense } from "react";

const RegistrarSW = lazy(() => import("@/components/RegistrarSW"));
const InstalarApp = lazy(() => import("@/components/InstalarApp"));
const ActivarAvisosAuto = lazy(() => import("@/components/ActivarAvisosAuto"));
export default function ComplementosPWA({ haySesion }: { haySesion: boolean }) {
  return (
    <Suspense fallback={null}>
      <RegistrarSW />
      <InstalarApp />
      <ActivarAvisosAuto haySesion={haySesion} />
    </Suspense>
  );
}
