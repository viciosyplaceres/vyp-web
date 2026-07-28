import assert from "node:assert/strict";
import test from "node:test";
import {
  esClaveDocumento,
  esClaveMusica,
} from "../src/lib/r2-claves.ts";

const uuid = "123e4567-e89b-42d3-a456-426614174000";

test("separa las claves públicas de música de los documentos internos", () => {
  assert.equal(esClaveMusica(`musica/${uuid}.mp3`), true);
  assert.equal(esClaveMusica(`documentos/${uuid}.pdf`), false);
  assert.equal(esClaveMusica("musica/../documentos/factura.pdf"), false);

  assert.equal(esClaveDocumento(`documentos/${uuid}.pdf`), true);
  assert.equal(esClaveDocumento(`musica/${uuid}.mp3`), false);
  assert.equal(esClaveDocumento("documentos/factura.pdf"), false);
});
