/** Formateo compartido por toda la app: fechas y tamaños. */

/**
 * Toda hora se escribe en la hora de aquí, pase donde pase el render.
 *
 * Sin fijarla, `toLocaleTimeString` usa la zona de quien ejecuta: el servidor
 * de Vercel va en UTC y el móvil de la peña en Europe/Madrid, así que el mismo
 * mensaje salía como "19:22" en el HTML del servidor y como "21:22" al
 * hidratar en el navegador. React lo detecta como un texto que no cuadra y
 * revienta con el error #418, tira el HTML del servidor y vuelve a pintar
 * entero en el cliente.
 *
 * Fijarla a Madrid arregla las dos cosas a la vez: servidor y navegador
 * escriben lo mismo, y la hora que se ve es la de las fiestas —que es la única
 * que le importa a nadie aquí— aunque alguien abra la web desde fuera.
 */
const ZONA = "Europe/Madrid";

/** El día ("2026-07-27") de un instante, ya en hora de aquí. */
function diaEnMadrid(f: Date): string {
  // "en-CA" da el formato ISO (año-mes-día), que se puede comparar como texto.
  return f.toLocaleDateString("en-CA", { timeZone: ZONA });
}

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
 * pantallas, con el mes escrito a mano. Ahora las tareas toman el rango real
 * que configura la directiva, incluso si las fiestas cruzan de mes, y esta
 * función deriva siempre el nombre correcto de la propia fecha.
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

/**
 * Un rango de fechas legible ("del 22 al 31 de agosto" o, si cruza de mes,
 * "del 30 de agosto al 3 de septiembre"). Para las fechas de las fiestas,
 * que la directiva fija cada año y ya no están atadas a agosto.
 */
export function rangoLegible(inicio: string, fin: string): string {
  const [, mesI, diaI] = inicio.split("-");
  const [, mesF, diaF] = fin.split("-");

  if (inicio === fin) return diaLegible(inicio) ?? "";
  if (mesI === mesF) {
    const nombreMes = MESES[Number(mesF) - 1];
    return `del ${Number(diaI)} al ${Number(diaF)} de ${nombreMes}`;
  }
  return `del ${diaLegible(inicio)} al ${diaLegible(fin)}`;
}

/** La hora de un instante ("14:05"), para los mensajes del chat. */
export function horaCorta(iso: string): string {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return "";
  return f.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ZONA,
  });
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

  const ahora = new Date();
  const ayer = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);

  // Se comparan los días ya convertidos a hora de aquí, no los componentes
  // de la fecha en bruto: si no, un mensaje de las 00:30 de Madrid (23:30 UTC
  // del día anterior) contaba como de otro día distinto según quién mirase.
  const dia = diaEnMadrid(f);
  if (dia === diaEnMadrid(ahora)) return "Hoy";
  if (dia === diaEnMadrid(ayer)) return "Ayer";

  return f.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: dia.slice(0, 4) === diaEnMadrid(ahora).slice(0, 4) ? undefined : "numeric",
    timeZone: ZONA,
  });
}

/** Tamaño en unidades legibles, redondeado como lo espera un humano. */
export function formatearBytes(bytes: number | null | undefined): string {
  if (!bytes) return "tamaño desconocido";
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

/**
 * Día y hora cortos ("27 jul, 21:22"), para los comentarios de la galería.
 * Con la zona fijada, por el mismo motivo que el resto: el comentario se pinta
 * en el servidor y se hidrata en el navegador, y los dos tienen que escribir
 * exactamente lo mismo.
 */
export function fechaCortaConHora(iso: string): string {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return "";
  return f.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ZONA,
  });
}
