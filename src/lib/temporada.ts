export const ZONA_TEMPORADA = "Europe/Madrid";

export const MENSAJE_TEMPORADA_CERRADA =
  "La temporada de cambios está cerrada. Se abre cada año del 1 de agosto al 10 de septiembre.";

const partesMadrid = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA_TEMPORADA,
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

function partesTemporada(ahora: Date | number) {
  const partes = partesMadrid.formatToParts(ahora);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    Number(partes.find((parte) => parte.type === tipo)?.value);

  return {
    mes: valor("month"),
    dia: valor("day"),
    hora: valor("hour"),
    minuto: valor("minute"),
    segundo: valor("second"),
  };
}

/** Del 1 de agosto 00:00 al 11 de septiembre 00:00, siempre en Madrid. */
export function temporadaAbierta(ahora: Date | number = Date.now()): boolean {
  const { mes, dia } = partesTemporada(ahora);

  return mes === 8 || (mes === 9 && dia <= 10);
}

/** Segundos restantes hasta el cierre; Infinity si el cierre no es inminente. */
export function segundosHastaCierreTemporada(
  ahora: Date | number = Date.now(),
): number {
  const { mes, dia, hora, minuto, segundo } = partesTemporada(ahora);
  if (!(mes === 8 || (mes === 9 && dia <= 10))) return 0;
  if (mes !== 9 || dia !== 10) return Number.POSITIVE_INFINITY;

  return 24 * 60 * 60 - (hora * 60 * 60 + minuto * 60 + segundo);
}
