import assert from "node:assert/strict";
import test from "node:test";
import { MIN_CONTRASENA, validarNuevaContrasena } from "../src/lib/contrasena.ts";

test("exige la contraseña actual", () => {
  assert.equal(
    validarNuevaContrasena("", "nuevaClave1", "nuevaClave1"),
    "Escribe tu contraseña actual.",
  );
});

test("la nueva debe tener al menos 8 caracteres", () => {
  const corta = validarNuevaContrasena("actual123", "corta", "corta");
  assert.match(corta, new RegExp(`${MIN_CONTRASENA} caracteres`));
  assert.equal(
    validarNuevaContrasena("actual123", "x".repeat(MIN_CONTRASENA), "x".repeat(MIN_CONTRASENA)),
    null,
  );
});

test("la nueva debe ser distinta de la actual", () => {
  assert.equal(
    validarNuevaContrasena("mismaClave1", "mismaClave1", "mismaClave1"),
    "La nueva contraseña debe ser distinta de la actual.",
  );
});

test("las dos copias de la nueva deben coincidir", () => {
  assert.equal(
    validarNuevaContrasena("actual123", "nuevaClave1", "nuevaClave2"),
    "Las dos contraseñas nuevas no coinciden.",
  );
});

test("una combinación válida no da error", () => {
  assert.equal(
    validarNuevaContrasena("generada123", "miClaveSegura9", "miClaveSegura9"),
    null,
  );
});
