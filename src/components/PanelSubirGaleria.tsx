"use client";

import { ImagePlus } from "lucide-react";
import PanelSubir from "./PanelSubir";
import SubirMedia from "./SubirMedia";

/**
 * Envoltorio de cliente para el panel de subida de la galería.
 *
 * Existe por un motivo concreto: `PanelSubir` necesita recibir el icono (que
 * es un componente) y los hijos como función (para poder cerrarse solo al
 * terminar). Nada de eso se puede enviar desde un Server Component — React no
 * sabe serializar funciones — y hacerlo reventaba la página con un 500.
 * Metiendo ese enlace aquí dentro, la página de servidor solo pasa datos
 * simples y el resto ocurre ya en el navegador.
 */
export default function PanelSubirGaleria({
  etiqueta = "Subir fotos o vídeos",
  anioInicial,
}: {
  etiqueta?: string;
  anioInicial?: number;
}) {
  return (
    <PanelSubir etiqueta={etiqueta} Icono={ImagePlus}>
      {(cerrar) => <SubirMedia anioInicial={anioInicial} onSubido={cerrar} />}
    </PanelSubir>
  );
}
