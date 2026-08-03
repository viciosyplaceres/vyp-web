"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { temporadaAbierta } from "@/lib/temporada";

const TemporadaContext = createContext(true);

export function TemporadaProvider({
  abiertaInicial,
  children,
}: {
  abiertaInicial: boolean;
  children: React.ReactNode;
}) {
  const [abierta, setAbierta] = useState(abiertaInicial);

  useEffect(() => {
    let temporizador: ReturnType<typeof setTimeout>;

    const actualizar = () => {
      setAbierta(temporadaAbierta());
      temporizador = setTimeout(actualizar, 1000 - (Date.now() % 1000) + 5);
    };

    temporizador = setTimeout(actualizar, 1000 - (Date.now() % 1000) + 5);
    return () => clearTimeout(temporizador);
  }, []);

  return (
    <TemporadaContext.Provider value={abierta}>
      {children}
    </TemporadaContext.Provider>
  );
}

export function useTemporadaAbierta(): boolean {
  return useContext(TemporadaContext);
}

export function AvisoTemporada() {
  const abierta = useTemporadaAbierta();
  if (abierta) return null;

  return (
    <div
      role="status"
      className="shrink-0 border-b border-amber-300/25 bg-amber-300/10 px-4 py-2 text-center text-xs text-amber-100 sm:text-sm"
    >
      Temporada cerrada: la app está en modo consulta. El contenido existente y
      los accesos siguen disponibles; las altas y cambios vuelven el 1 de agosto.
    </div>
  );
}

export function SoloTemporadaAbierta({ children }: { children: React.ReactNode }) {
  return useTemporadaAbierta() ? children : null;
}
