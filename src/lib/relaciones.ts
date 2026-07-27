/**
 * Ayudas para leer las relaciones que devuelve PostgREST.
 *
 * Cuando una consulta pide algo como `autores(nombre, avatar_url)`, la
 * biblioteca de Supabase no sabe de antemano si esa relación es de uno a uno
 * o de uno a muchos, así que tipa el resultado como "objeto o array de
 * objetos". En la práctica aquí siempre es un único registro (el autor de una
 * foto, de un mensaje…), pero hay que desenvolverlo en todos los sitios.
 *
 * Esto vivía copiado y pegado en siete ficheros distintos —la portada dos
 * veces— con el mismo tipo local declarado una y otra vez. Aquí se declara
 * una sola vez.
 */

/** Autor tal y como lo devuelve la vista `autores` embebida en una consulta. */
export type AutorRelacionado = {
  nombre: string | null;
  avatar_url: string | null;
};

/** Deja en un único objeto (o null) lo que PostgREST tipa como objeto-o-array. */
export function unaRelacion<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

/**
 * Extrae el nombre y el avatar del autor embebido en una fila.
 * Devuelve siempre las dos claves, aunque la relación venga vacía.
 */
export function autorDe(rel: unknown): {
  nombre: string | null;
  avatarUrl: string | null;
} {
  const autor = unaRelacion(rel as AutorRelacionado | AutorRelacionado[] | null);
  return {
    nombre: autor?.nombre ?? null,
    avatarUrl: autor?.avatar_url ?? null,
  };
}

/**
 * Aplana `[{ tareas: {...} }, ...]` en `[{...}, ...]`, descartando las filas
 * cuya relación viniera vacía.
 *
 * Es el patrón de las tablas puente (`tareas_miembros`, `compra_miembros`):
 * se consulta la tabla de en medio y lo que interesa es lo que cuelga de ella.
 */
export function aplanarRelacion<T>(
  filas: unknown[] | null | undefined,
  campo: string,
): T[] {
  return (filas ?? [])
    .map((fila) => unaRelacion((fila as Record<string, unknown>)[campo] as T | T[]))
    .filter((valor): valor is T => valor !== null);
}
