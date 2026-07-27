"use client";

import { Music } from "lucide-react";
import PanelSubir from "./PanelSubir";
import SubirMusica from "./SubirMusica";

/** Igual que PanelSubirGaleria, pero para la música. Ver allí el porqué. */
export default function PanelSubirMusica() {
  return (
    <PanelSubir etiqueta="Subir música" Icono={Music}>
      {(cerrar) => <SubirMusica onSubido={cerrar} />}
    </PanelSubir>
  );
}
