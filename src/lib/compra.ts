export const MAX_ARTICULOS_POR_TANDA = 100;
export const MAX_ASIGNADOS_POR_TANDA = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ArticuloCompraNuevo = { item: string; cantidad: number };
type Resultado<T> = { datos: T; error: null } | { datos: null; error: string };

export function validarArticulosCompra(valor: string): Resultado<ArticuloCompraNuevo[]> {
  let recibido: unknown;
  try {
    recibido = JSON.parse(valor);
  } catch {
    return { datos: null, error: "La lista de artículos no es válida." };
  }

  if (!Array.isArray(recibido) || recibido.length === 0) {
    return { datos: null, error: "Añade al menos un artículo." };
  }
  if (recibido.length > MAX_ARTICULOS_POR_TANDA) {
    return {
      datos: null,
      error: `Puedes añadir hasta ${MAX_ARTICULOS_POR_TANDA} artículos por tanda.`,
    };
  }

  const articulos = recibido.map((entrada) => {
    const fila = entrada as { item?: unknown; cantidad?: unknown };
    return {
      item: String(fila.item ?? "").trim(),
      cantidad: Number(fila.cantidad),
    };
  });

  if (articulos.some((entrada) => !entrada.item || entrada.item.length > 200)) {
    return {
      datos: null,
      error: "Completa todos los artículos (máximo 200 caracteres).",
    };
  }
  if (
    articulos.some(
      (entrada) =>
        !Number.isInteger(entrada.cantidad) || entrada.cantidad < 1 || entrada.cantidad > 9999,
    )
  ) {
    return {
      datos: null,
      error: "Cada cantidad debe ser un número entre 1 y 9999.",
    };
  }

  return { datos: articulos, error: null };
}

export function validarAsignadosCompra(valor: string): Resultado<string[]> {
  const asignados = [
    ...new Set(
      valor
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];

  if (asignados.length > MAX_ASIGNADOS_POR_TANDA) {
    return {
      datos: null,
      error: `Puedes asignar hasta ${MAX_ASIGNADOS_POR_TANDA} miembros por tanda.`,
    };
  }
  if (asignados.some((id) => !UUID.test(id))) {
    return { datos: null, error: "La lista de encargados no es válida." };
  }

  return { datos: asignados, error: null };
}
