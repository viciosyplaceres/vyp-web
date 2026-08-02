// Validación del cambio de contraseña del perfil.
// Función pura: se prueba en tests/contrasena.test.mjs.

export const MIN_CONTRASENA = 8;

/**
 * Reglas antes de llamar a Supabase: la actual es obligatoria (se vuelve a
 * comprobar contra Auth), la nueva pide un mínimo de 8 caracteres, debe ser
 * distinta de la que tenía y las dos copias tienen que coincidir.
 */
export function validarNuevaContrasena(
  actual: string,
  nueva: string,
  repetir: string,
): string | null {
  if (!actual) return "Escribe tu contraseña actual.";
  if (nueva.length < MIN_CONTRASENA) {
    return `La nueva contraseña debe tener al menos ${MIN_CONTRASENA} caracteres.`;
  }
  if (nueva === actual) {
    return "La nueva contraseña debe ser distinta de la actual.";
  }
  if (nueva !== repetir) {
    return "Las dos contraseñas nuevas no coinciden.";
  }
  return null;
}
