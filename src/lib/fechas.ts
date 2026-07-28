/** Fechas ISO de un rango inclusivo, operando en UTC para evitar saltos de zona horaria. */
export function fechasEntre(inicio: string, fin: string): string[] {
  const patron = /^\d{4}-\d{2}-\d{2}$/;
  if (!patron.test(inicio) || !patron.test(fin) || fin < inicio) return [];

  const inicioMs = Date.parse(`${inicio}T00:00:00Z`);
  const finMs = Date.parse(`${fin}T00:00:00Z`);
  if (!Number.isFinite(inicioMs) || !Number.isFinite(finMs)) return [];

  const resultado: string[] = [];
  for (let fecha = inicioMs; fecha <= finMs && resultado.length < 370; fecha += 86_400_000) {
    resultado.push(new Date(fecha).toISOString().slice(0, 10));
  }
  return resultado;
}
