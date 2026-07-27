"use client";

export type SubidoACloudinary = {
  url: string;
  storageId: string;
  bytes: number | null;
};

/**
 * Sube una imagen a Cloudinary con firma del servidor y devuelve lo que hay
 * que guardar en la base de datos.
 *
 * El flujo es siempre el mismo —pedir firma a `/api/cloudinary/firma`, mandar
 * el archivo a Cloudinary, quedarse con `secure_url` y `public_id`— y estaba
 * escrito entero en el componente del avatar y otra vez en el de la galería.
 * Al añadir camisetas y tickets iban a ser cuatro copias, así que vive aquí.
 *
 * La carpeta NO se manda desde aquí: la decide el servidor a partir del tipo,
 * que es lo que impide que nadie escriba donde no debe.
 */
export async function subirImagenFirmada(
  fichero: File,
  tipo: "avatar" | "camiseta" | "ticket",
  anio?: number,
): Promise<SubidoACloudinary> {
  const resFirma = await fetch("/api/cloudinary/firma", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tipo, anio }),
  });

  if (!resFirma.ok) {
    const cuerpo = await resFirma.json().catch(() => ({}));
    throw new Error(cuerpo.error ?? "No se pudo preparar la subida.");
  }

  const firma = await resFirma.json();

  const datos = new FormData();
  datos.append("file", fichero);
  datos.append("api_key", firma.apiKey);
  datos.append("timestamp", String(firma.timestamp));
  datos.append("signature", firma.signature);
  datos.append("folder", firma.folder);

  const resSubida = await fetch(
    `https://api.cloudinary.com/v1_1/${firma.cloudName}/image/upload`,
    { method: "POST", body: datos },
  );

  if (!resSubida.ok) {
    const cuerpo = await resSubida.json().catch(() => ({}));
    throw new Error(cuerpo?.error?.message ?? "Cloudinary rechazó la imagen.");
  }

  const subido = await resSubida.json();

  return {
    url: subido.secure_url as string,
    storageId: subido.public_id as string,
    bytes: (subido.bytes as number) ?? null,
  };
}

/**
 * Encoge la foto en el propio móvil antes de subirla. La biblioteca pesa
 * 51 KB y se trae solo cuando de verdad hace falta comprimir, no al cargar la
 * página (ver el mismo criterio en `SubirMedia`).
 */
export async function comprimirImagen(
  fichero: File,
  maxLado = 1600,
): Promise<File> {
  const { default: imageCompression } = await import("browser-image-compression");
  return imageCompression(fichero, {
    maxWidthOrHeight: maxLado,
    maxSizeMB: 1.5,
    useWebWorker: true,
  });
}
