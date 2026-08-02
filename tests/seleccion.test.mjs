import assert from "node:assert/strict";
import test from "node:test";
import { alternarSeleccion, alternarTodas } from "../src/lib/seleccion.ts";

test("alternarSeleccion marca y desmarca sin mutar el Set original", () => {
  const inicial = new Set(["a"]);
  const marcada = alternarSeleccion(inicial, "b");
  assert.deepEqual([...marcada].sort(), ["a", "b"]);
  assert.deepEqual([...inicial], ["a"]); // el original no cambia

  const desmarcada = alternarSeleccion(marcada, "a");
  assert.deepEqual([...desmarcada], ["b"]);
});

test("alternarTodas marca todo y, si ya está todo marcado, vacía", () => {
  const ids = ["a", "b", "c"];
  const todas = alternarTodas(new Set(["a"]), ids);
  assert.deepEqual([...todas].sort(), ids);

  const ninguna = alternarTodas(todas, ids);
  assert.equal(ninguna.size, 0);
});

test("alternarTodas con lista vacía no inventa selección", () => {
  assert.equal(alternarTodas(new Set(), []).size, 0);
});

test("alternarTodas marca todo aunque falte solo una", () => {
  const resultado = alternarTodas(new Set(["a", "b"]), ["a", "b", "c"]);
  assert.deepEqual([...resultado].sort(), ["a", "b", "c"]);
});
