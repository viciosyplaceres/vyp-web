"use client";

import { Music } from "lucide-react";
import PanelSubir from "./PanelSubir";
import SubirMusica from "./SubirMusica";
import { useTemporadaAbierta } from "./Temporada";

/** Igual que PanelSubirGaleria, pero para la música. Ver allí el porqué. */
export default function PanelSubirMusica() {
  const abierta = useTemporadaAbierta();
  if (!abierta) return null;

  return (
    <PanelSubir etiqueta="Subir música" Icono={Music}>
      {(cerrar) => <SubirMusica onSubido={cerrar} />}
    </PanelSubir>
  );
}
