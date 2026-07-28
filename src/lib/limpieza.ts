/**
 * El reparto de la limpieza de las fiestas, sorteado a dados.
 *
 * Del primer día al penúltimo limpian 2 personas cada día; el último no es
 * solo limpieza sino **limpieza y desmontaje**, y ahí van 3.
 *
 * Las fechas de las fiestas las fija la directiva cada año desde Gestión
 * (tabla `fiestas_fechas`): este módulo no sabe nada de agosto ni de ningún
 * mes en concreto, solo recibe un rango de fechas y reparte los turnos
 * dentro de él. Así el año que viene no hace falta tocar código, solo elegir
 * las fechas nuevas.
 */

export const PLAZAS_NORMAL = 2;
export const PLAZAS_DESMONTAJE = 3;

export type DiaLimpieza = {
  fecha: string;
  plazas: number;
  desmontaje: boolean;
};

/**
 * Todos los días entre `fechaInicio` y `fechaFin` (ambos incluidos), como
 * cadenas "AAAA-MM-DD". Se opera en UTC a propósito: son fechas sueltas sin
 * hora, y sumar un día de calendario con el reloj local podría saltarse o
 * repetir un día según en qué zona horaria corra el servidor.
 */
export function diasLimpieza(
  fechaInicio: string,
  fechaFin: string,
  plazasNormal = PLAZAS_NORMAL,
  plazasDesmontaje = PLAZAS_DESMONTAJE,
): DiaLimpieza[] {
  const [anioI, mesI, diaI] = fechaInicio.split("-").map(Number);
  const [anioF, mesF, diaF] = fechaFin.split("-").map(Number);
  const inicio = Date.UTC(anioI, mesI - 1, diaI);
  const fin = Date.UTC(anioF, mesF - 1, diaF);

  const dias: DiaLimpieza[] = [];
  for (let t = inicio; t <= fin; t += 24 * 60 * 60 * 1000) {
    const f = new Date(t);
    const fecha = `${f.getUTCFullYear()}-${String(f.getUTCMonth() + 1).padStart(2, "0")}-${String(f.getUTCDate()).padStart(2, "0")}`;
    const desmontaje = t === fin;
    dias.push({
      fecha,
      plazas: desmontaje ? plazasDesmontaje : plazasNormal,
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
 * Sortea el reparto entero para los `dias` que se le pasen (normalmente el
 * resultado de `diasLimpieza` con las fechas que fijó la directiva).
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
  dias: DiaLimpieza[],
  aleatorio: () => number = Math.random,
): ResultadoSorteo {
  const maximoPlazas = Math.max(0, ...dias.map((dia) => dia.plazas));
  if (numMiembros < maximoPlazas) {
    throw new Error(
      `Para sortear la limpieza hacen falta al menos ${maximoPlazas} miembros aprobados.`,
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

    for (const d of dias) {
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
