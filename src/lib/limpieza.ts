/**
 * El reparto de la limpieza de las fiestas, sorteado a dados.
 *
 * Del 22 al 30 de agosto limpian 2 personas cada día; el 31 no es solo
 * limpieza sino **limpieza y desmontaje**, y ahí van 3. Son 21 turnos en
 * total.
 *
 * Con 9 miembros eso sale a 21 / 9 = 2 turnos y pico por cabeza: no hay
 * forma de que toque a todos por igual. Lo más justo posible es que **todos
 * limpien 2 días**, y que los 3 turnos que sobran caigan justo en el
 * desmontaje —el único sitio donde no queda otra— en vez de repartir terceros
 * turnos sueltos por días normales.
 */

export const MES_LIMPIEZA = 8;
export const DIA_INICIO = 22;
export const DIA_FIN = 31;
export const PLAZAS_NORMAL = 2;
export const PLAZAS_DESMONTAJE = 3;

export type DiaLimpieza = {
  dia: number;
  fecha: string;
  plazas: number;
  desmontaje: boolean;
};

export function diasLimpieza(anio: number): DiaLimpieza[] {
  const dias: DiaLimpieza[] = [];
  for (let d = DIA_INICIO; d <= DIA_FIN; d++) {
    const desmontaje = d === DIA_FIN;
    dias.push({
      dia: d,
      fecha: `${anio}-${String(MES_LIMPIEZA).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      plazas: desmontaje ? PLAZAS_DESMONTAJE : PLAZAS_NORMAL,
      desmontaje,
    });
  }
  return dias;
}

/**
 * Caras del dado: siempre alguna más que miembros hay, para que de verdad
 * existan tiradas que no le tocan a nadie y haya que repetir —que es media
 * gracia del sorteo—. Con 9 miembros sale un dado de 10: el 10 no es de
 * nadie y se vuelve a tirar.
 *
 * A propósito NO se usan dos dados de seis sumados: la suma no es uniforme
 * (el 7 sale seis veces más que el 2), así que quien tuviera los números
 * centrales limpiaría mucho más. Un dado de caras iguales es lo único justo.
 */
export function carasDado(numMiembros: number): number {
  for (const caras of [6, 10, 12, 20]) if (numMiembros <= caras) return caras;
  return Math.ceil(numMiembros / 10) * 10;
}

export type Tirada = {
  fecha: string;
  cara: number;
  valida: boolean;
  /** Índice del miembro al que le tocó, solo si la tirada valió. */
  miembro?: number;
  motivo?: "sin-miembro" | "repetido-dia" | "ya-tiene-lo-suyo";
};

export type ResultadoSorteo = {
  /** Miembros (por índice) que limpian cada día. */
  porFecha: Map<string, number[]>;
  /** Cuántos turnos acaba teniendo cada miembro. */
  cuenta: number[];
  /** Todas las tiradas, incluidas las descartadas: es el guion de la animación. */
  tiradas: Tirada[];
  caras: number;
};

/**
 * Sortea el reparto entero.
 *
 * La regla que lo mantiene justo es una sola: **nadie puede llevar más de un
 * turno por encima de quien menos lleva**. Con eso, el propio sorteo se
 * equilibra sin necesidad de repartir cupos a mano — y si un día entran más
 * miembros o se va alguien, sigue saliendo lo más repartido posible sin tocar
 * nada. Si el dado saca a alguien que ya va servido, o que ya limpia ese día,
 * o un número que no es de nadie, se vuelve a tirar. Igual que en la mesa.
 */
export function sortearLimpieza(
  numMiembros: number,
  anio: number,
  aleatorio: () => number = Math.random,
): ResultadoSorteo {
  if (numMiembros < PLAZAS_DESMONTAJE) {
    throw new Error(
      `Para sortear la limpieza hacen falta al menos ${PLAZAS_DESMONTAJE} miembros aprobados.`,
    );
  }

  const caras = carasDado(numMiembros);

  // El bloqueo (quedarse sin nadie a quien asignar una plaza) es rarísimo,
  // pero si pasa se vuelve a empezar en vez de dejar el reparto a medias.
  for (let intento = 0; intento < 50; intento++) {
    const cuenta = new Array<number>(numMiembros).fill(0);
    const porFecha = new Map<string, number[]>();
    const tiradas: Tirada[] = [];
    let bloqueado = false;

    for (const d of diasLimpieza(anio)) {
      const delDia: number[] = [];

      for (let plaza = 0; plaza < d.plazas; plaza++) {
        const minimo = Math.min(...cuenta);
        const puede = (m: number) => !delDia.includes(m) && cuenta[m] < minimo + 1;

        if (!Array.from({ length: numMiembros }, (_, i) => i).some(puede)) {
          bloqueado = true;
          break;
        }

        for (let giro = 0; giro < 5000; giro++) {
          const cara = Math.floor(aleatorio() * caras) + 1;
          const m = cara - 1;

          if (m >= numMiembros) {
            tiradas.push({ fecha: d.fecha, cara, valida: false, motivo: "sin-miembro" });
            continue;
          }
          if (delDia.includes(m)) {
            tiradas.push({ fecha: d.fecha, cara, valida: false, motivo: "repetido-dia" });
            continue;
          }
          if (cuenta[m] >= minimo + 1) {
            tiradas.push({ fecha: d.fecha, cara, valida: false, motivo: "ya-tiene-lo-suyo" });
            continue;
          }

          tiradas.push({ fecha: d.fecha, cara, valida: true, miembro: m });
          delDia.push(m);
          cuenta[m]++;
          break;
        }
      }

      if (bloqueado) break;
      porFecha.set(d.fecha, delDia);
    }

    if (!bloqueado) return { porFecha, cuenta, tiradas, caras };
  }

  throw new Error("No se pudo repartir la limpieza. Inténtalo otra vez.");
}
