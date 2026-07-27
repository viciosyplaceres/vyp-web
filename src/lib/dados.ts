/**
 * Dados para decidir cosas al vuelo: sin guardar nada, cada tirada es
 * independiente. Dos modos:
 *
 * - **Mayor o menor de 6**: para partir en dos cualquier decisión ("¿vamos a
 *   la playa o al pueblo?"). Un dado de 12 caras porque con uno de 6 nunca
 *   podría salir "mayor de 6"; el 6 justo en el medio no cuenta para ninguno
 *   y se repite la tirada, para no tener que decidir qué hacer con un empate.
 * - **Por miembro**: el mismo mecanismo del sorteo de la limpieza (un dado
 *   con más caras que gente, y el número que no es de nadie obliga a
 *   repetir), pero para una sola tirada suelta en vez de un calendario
 *   entero.
 */

import { carasDado } from "./limpieza";
export { carasDado };

export const CARAS_MAYOR_MENOR = 12;
export const UMBRAL_MAYOR_MENOR = 6;

export type TiradaSimple = {
  cara: number;
  valida: boolean;
};

export type TiradaMayorMenor = TiradaSimple & {
  resultado?: "mayor" | "menor";
};

export type TiradaMiembro = TiradaSimple & {
  miembro?: number;
};

/**
 * Tira hasta que el dado de 12 caras no saque el 6 (empate, se repite).
 * Devuelve también las tiradas descartadas, para poder animarlas igual que
 * en la limpieza.
 */
export function tirarMayorMenor(
  aleatorio: () => number = Math.random,
): { tiradas: TiradaMayorMenor[]; resultado: "mayor" | "menor" } {
  const tiradas: TiradaMayorMenor[] = [];

  for (let giro = 0; giro < 5000; giro++) {
    const cara = Math.floor(aleatorio() * CARAS_MAYOR_MENOR) + 1;

    if (cara === UMBRAL_MAYOR_MENOR) {
      tiradas.push({ cara, valida: false });
      continue;
    }

    const resultado = cara > UMBRAL_MAYOR_MENOR ? "mayor" : "menor";
    tiradas.push({ cara, valida: true, resultado });
    return { tiradas, resultado };
  }

  throw new Error("No se pudo tirar el dado. Inténtalo otra vez.");
}

/**
 * Tira hasta que salga el número de un miembro real. `numMiembros` es
 * cuántos hay en la lista que se pasó (cada uno tiene su cara, del 1 en
 * adelante); las caras que sobran del dado no son de nadie.
 */
export function tirarPorMiembro(
  numMiembros: number,
  aleatorio: () => number = Math.random,
): { tiradas: TiradaMiembro[]; miembro: number; caras: number } {
  if (numMiembros < 2) {
    throw new Error("Hacen falta al menos dos miembros para tirar por miembro.");
  }

  const caras = carasDado(numMiembros);
  const tiradas: TiradaMiembro[] = [];

  for (let giro = 0; giro < 5000; giro++) {
    const cara = Math.floor(aleatorio() * caras) + 1;
    const miembro = cara - 1;

    if (miembro >= numMiembros) {
      tiradas.push({ cara, valida: false });
      continue;
    }

    tiradas.push({ cara, valida: true, miembro });
    return { tiradas, miembro, caras };
  }

  throw new Error("No se pudo tirar el dado. Inténtalo otra vez.");
}
