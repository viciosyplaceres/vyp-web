import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "@/lib/r2";
import { getSesion } from "@/lib/auth";
import { haySitioR2 } from "@/lib/almacenamiento";

const TIPOS_AUDIO = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/flac",
];

const TIPOS_DOCUMENTO = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

/** 500 MB para música (una sesión larga cabe de sobra); 20 MB para documentos. */
const MAX_AUDIO = 500 * 1024 * 1024;
const MAX_DOCUMENTO = 20 * 1024 * 1024;

/**
 * Devuelve una URL prefirmada para subir directamente a R2 desde el navegador,
 * sin que el fichero pase por el servidor de Next (que tiene límite de tamaño
 * de petición). Solo para miembros aprobados.
 *
 * `destino` decide qué se admite y dónde cae:
 *  - "musica"     → audio, hasta 500 MB, prefijo musica/
 *  - "documento"  → PDF/imagen/ofimática, hasta 20 MB, prefijo documentos/
 */
export async function POST(request: Request) {
  const sesion = await getSesion();
  if (!sesion?.esMiembro) {
    return NextResponse.json(
      { error: "Solo los miembros de la peña pueden subir." },
      { status: 403 },
    );
  }

  const { nombre, contentType, tamano, destino } = await request
    .json()
    .catch(() => ({}));

  if (typeof nombre !== "string" || !nombre.trim()) {
    return NextResponse.json({ error: "Falta el nombre." }, { status: 400 });
  }

  const esDocumento = destino === "documento";
  const tiposOk = esDocumento ? TIPOS_DOCUMENTO : TIPOS_AUDIO;
  const maxBytes = esDocumento ? MAX_DOCUMENTO : MAX_AUDIO;
  const prefijo = esDocumento ? "documentos" : "musica";
  const extPorDefecto = esDocumento ? "pdf" : "mp3";

  if (!tiposOk.includes(String(contentType))) {
    return NextResponse.json(
      {
        error: esDocumento
          ? "Formato no admitido. Vale PDF, imagen, Word, Excel o texto."
          : "Solo se admiten ficheros de audio.",
      },
      { status: 400 },
    );
  }

  if (!Number.isFinite(tamano) || tamano <= 0 || tamano > maxBytes) {
    return NextResponse.json(
      {
        error: `El fichero supera el máximo de ${Math.round(maxBytes / (1024 * 1024))} MB.`,
      },
      { status: 400 },
    );
  }

  // Antes de firmar nada: si este fichero no cabe sin pasar del 90% del plan
  // gratuito de R2, se corta aquí y no en mitad de la subida.
  const sitio = await haySitioR2(tamano);
  if (!sitio.ok) {
    return NextResponse.json({ error: sitio.error }, { status: 507 });
  }

  // La clave la decide el servidor: el cliente no elige dónde escribe.
  const extension = (nombre.split(".").pop() ?? extPorDefecto)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 5);
  const clave = `${prefijo}/${crypto.randomUUID()}.${extension || extPorDefecto}`;

  const url = await getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: clave,
      ContentType: contentType,
      ContentLength: tamano,
    }),
    { expiresIn: 60 * 30 },
  );

  return NextResponse.json({ url, clave });
}
