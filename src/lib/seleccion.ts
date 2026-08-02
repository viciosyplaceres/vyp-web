/**
 * Selección múltiple para listas con casillas (panel de almacenamiento).
 * Funciones puras: el estado vive en un Set<string> con los ids marcados.
 */

/** Marca o desmarca un id, devolviendo un Set nuevo (estado inmutable). */
export function alternarSeleccion(
  seleccion: ReadonlySet<string>,
  id: string,
): Set<string> {
  const siguiente = new Set(seleccion);
  if (siguiente.has(id)) siguiente.delete(id);
  else siguiente.add(id);
  return siguiente;
}

/**
 * Marca todas las casillas; si ya estaban todas marcadas, las desmarca.
 * Con la lista vacía siempre devuelve una selección vacía.
 */
export function alternarTodas(
  seleccion: ReadonlySet<string>,
  ids: string[],
): Set<string> {
  const todasMarcadas =
    ids.length > 0 && ids.every((id) => seleccion.has(id));
  return todasMarcadas ? new Set() : new Set(ids);
}
