import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_ARTICULOS_POR_TANDA,
  MAX_ASIGNADOS_POR_TANDA,
  validarArticulosCompra,
  validarAsignadosCompra,
} from "../src/lib/compra.ts";

const uuid = "123e4567-e89b-42d3-a456-426614174000";

test("normaliza una tanda válida de compra", () => {
  const resultado = validarArticulosCompra(
    JSON.stringify([
      { item: "  Hielo  ", cantidad: 2 },
      { item: "Vasos", cantidad: 5 },
    ]),
  );

  assert.deepEqual(resultado, {
    datos: [
      { item: "Hielo", cantidad: 2 },
      { item: "Vasos", cantidad: 5 },
    ],
    error: null,
  });
});

test("rechaza tandas vacías, excesivas y cantidades no enteras", () => {
  assert.equal(validarArticulosCompra("[]").datos, null);
  assert.equal(
    validarArticulosCompra(
      JSON.stringify(
        Array.from({ length: MAX_ARTICULOS_POR_TANDA + 1 }, () => ({
          item: "Agua",
          cantidad: 1,
        })),
      ),
    ).datos,
    null,
  );
  assert.equal(
    validarArticulosCompra(JSON.stringify([{ item: "Agua", cantidad: 1.5 }])).datos,
    null,
  );
});

test("deduplica encargados y rechaza UUID o lotes no válidos", () => {
  assert.deepEqual(validarAsignadosCompra(`${uuid},${uuid}`), {
    datos: [uuid],
    error: null,
  });
  assert.equal(validarAsignadosCompra("no-es-uuid").datos, null);

  const demasiados = Array.from(
    { length: MAX_ASIGNADOS_POR_TANDA + 1 },
    (_, i) => `00000000-0000-0000-0000-${i.toString(16).padStart(12, "0")}`,
  ).join(",");
  assert.equal(validarAsignadosCompra(demasiados).datos, null);
});
