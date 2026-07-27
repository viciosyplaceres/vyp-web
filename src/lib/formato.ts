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

/** La hora de un instante ("14:05"), para los mensajes del chat. */
export function horaCorta(iso: string): string {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return "";
  return f.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

/**
 * El día de un instante contado desde hoy ("Hoy", "Ayer", "3 de agosto"),
 * para los separadores del chat.
 *
 * No confundir con `diaLegible`, que recibe una fecha suelta sin hora
 * ("2026-08-14") y siempre la escribe entera. Aquí hay un instante real y sí
 * importa a qué distancia queda de hoy.
 */
export function diaRelativo(iso: string): string {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return "";
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);

  const mismoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (mismoDia(f, hoy)) return "Hoy";
  if (mismoDia(f, ayer)) return "Ayer";
  return f.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: f.getFullYear() === hoy.getFullYear() ? undefined : "numeric",
  });
}

/** Tamaño en unidades legibles, redondeado como lo espera un humano. */
export function formatearBytes(bytes: number | null | undefined): string {
  if (!bytes) return "tamaño desconocido";
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}
