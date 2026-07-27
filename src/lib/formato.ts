/** Formateo compartido por toda la app: fechas y tamaños. */

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * Convierte la fecha de una tarea ("2026-08-14") en algo legible ("14 de
 * agosto").
 *
 * Se lee la cadena directamente en vez de construir un `new Date(...)`: una
 * fecha suelta sin hora se interpreta como UTC, y al pintarla en España
 * saldría el día anterior en cuanto la zona horaria va por delante. Aquí el
 * día es literal, no un instante en el tiempo.
 *
 * Antes esto era un `Number(fecha.slice(8, 10))} de agosto` repetido en tres
 * pantallas, con el mes escrito a mano. Hoy no da un resultado incorrecto
 * porque el panel de tareas solo deja elegir días de agosto, pero deriva el
 * mes de la propia fecha para que siga siendo cierto el día que se apunte
 * algo de otro mes (los preparativos de julio, por ejemplo).
 */
export function diaLegible(fecha: string | null | undefined): string | null {
  if (!fecha) return null;

  const [, mes, dia] = fecha.split("-");
  const numeroMes = Number(mes);
  const numeroDia = Number(dia);
  if (!numeroMes || !numeroDia) return null;

  const nombreMes = MESES[numeroMes - 1];
  return nombreMes ? `${numeroDia} de ${nombreMes}` : null;
}

/** Tamaño en unidades legibles, redondeado como lo espera un humano. */
export function formatearBytes(bytes: number | null | undefined): string {
  if (!bytes) return "tamaño desconocido";
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}
