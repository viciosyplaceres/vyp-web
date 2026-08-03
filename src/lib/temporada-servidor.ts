import "server-only";

import {
  MENSAJE_TEMPORADA_CERRADA,
  temporadaAbierta,
} from "@/lib/temporada";

/** Guardia común para cualquier escritura normal del servidor. */
export function exigirTemporadaAbierta(ahora: Date | number = Date.now()): void {
  if (!temporadaAbierta(ahora)) {
    throw new Error(MENSAJE_TEMPORADA_CERRADA);
  }
}
