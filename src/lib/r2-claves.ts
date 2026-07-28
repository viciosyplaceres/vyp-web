const UUID_V4 =
  "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const EXTENSION = "[a-z0-9]{1,5}";

const PATRON_MUSICA = new RegExp(`^musica/${UUID_V4}\\.${EXTENSION}$`, "i");
const PATRON_DOCUMENTO = new RegExp(
  `^documentos/${UUID_V4}\\.${EXTENSION}$`,
  "i",
);

export function esClaveMusica(clave: unknown): clave is string {
  return typeof clave === "string" && PATRON_MUSICA.test(clave);
}

export function esClaveDocumento(clave: unknown): clave is string {
  return typeof clave === "string" && PATRON_DOCUMENTO.test(clave);
}
