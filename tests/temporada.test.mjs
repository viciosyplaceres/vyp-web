import assert from "node:assert/strict";
import test from "node:test";
import {
  segundosHastaCierreTemporada,
  ZONA_TEMPORADA,
  temporadaAbierta,
} from "../src/lib/temporada.ts";

test("usa siempre Europe/Madrid", () => {
  assert.equal(ZONA_TEMPORADA, "Europe/Madrid");
});

test("abre exactamente el 1 de agosto a las 00:00 de Madrid", () => {
  assert.equal(temporadaAbierta(new Date("2026-07-31T21:59:59.999Z")), false);
  assert.equal(temporadaAbierta(new Date("2026-07-31T22:00:00.000Z")), true);
});

test("permanece abierta todo el 10 de septiembre y cierra al empezar el 11", () => {
  assert.equal(temporadaAbierta(new Date("2026-09-10T21:59:59.999Z")), true);
  assert.equal(temporadaAbierta(new Date("2026-09-10T22:00:00.000Z")), false);
});

test("no depende de la zona horaria del proceso", () => {
  const zonaOriginal = process.env.TZ;
  try {
    process.env.TZ = "America/Los_Angeles";
    assert.equal(temporadaAbierta(new Date("2027-07-31T22:00:00.000Z")), true);
    assert.equal(temporadaAbierta(new Date("2027-09-10T22:00:00.000Z")), false);
  } finally {
    if (zonaOriginal === undefined) delete process.env.TZ;
    else process.env.TZ = zonaOriginal;
  }
});

test("las capacidades de subida caducan al cerrar la temporada", () => {
  assert.equal(
    segundosHastaCierreTemporada(new Date("2026-09-10T21:30:00.000Z")),
    30 * 60,
  );
  assert.equal(
    segundosHastaCierreTemporada(new Date("2026-09-10T21:59:59.000Z")),
    1,
  );
  assert.equal(
    segundosHastaCierreTemporada(new Date("2026-09-10T22:00:00.000Z")),
    0,
  );
  assert.equal(
    segundosHastaCierreTemporada(new Date("2026-08-15T12:00:00.000Z")),
    Number.POSITIVE_INFINITY,
  );
});
