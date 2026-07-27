/** Comprobación del origen de las imágenes. Sin "use client": la usan los dos lados. */

/**
 * ¿Esta URL es de verdad una imagen de nuestro Cloudinary?
 *
 * Las URLs de las imágenes subidas llegan al servidor **desde el navegador**
 * (el archivo se sube directo a Cloudinary y al formulario solo viaja la URL
 * resultante), así que son un dato de fuera: nada impide a alguien mandar otra
 * cosa en su lugar, incluida una `javascript:...`. Eso importa sobre todo en
 * los tickets de las deudas, porque se pintan como un enlace y las deudas las
 * ve **toda la peña**, no solo quien apuntó el gasto.
 *
 * Se exige `https` y el dominio exacto de Cloudinary. `new URL()` hace el
 * trabajo sucio: compara el host ya normalizado, sin dejar hueco a trucos del
 * estilo `https://res.cloudinary.com.otrositio.com/`.
 */
export function esUrlDeCloudinary(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "res.cloudinary.com";
  } catch {
    return false;
  }
}
