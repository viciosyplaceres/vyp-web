import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "@/lib/r2";
import { getSesion } from "@/lib/auth";

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

/** 500 MB: una sesión de DJ larga cabe de sobra y sigue siendo un tope sano. */
const MAX_BYTES = 500 * 1024 * 1024;

/**
 * Devuelve una URL prefirmada para subir un audio directamente a R2 desde el
 * navegador, sin que el fichero pase por el servidor de Next (que tiene límite
 * de tamaño de petición). Solo para miembros aprobados.
 */
export async function POST(request: Request) {
  const sesion = await getSesion();
  if (!sesion?.esMiembro) {
    return NextResponse.json(
      { error: "Solo los miembros de la peña pueden subir música." },
      { status: 403 },
    );
  }

  const { nombre, contentType, tamano } = await request
    .json()
    .catch(() => ({}));

  if (typeof nombre !== "string" || !nombre.trim()) {
    return NextResponse.json({ error: "Falta el nombre." }, { status: 400 });
  }
  if (!TIPOS_AUDIO.includes(String(contentType))) {
    return NextResponse.json(
      { error: "Solo se admiten ficheros de audio." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(tamano) || tamano <= 0 || tamano > MAX_BYTES) {
    return NextResponse.json(
      { error: "El fichero supera el máximo de 500 MB." },
      { status: 400 },
    );
  }

  // La clave la decide el servidor: el cliente no elige dónde escribe.
  const extension = (nombre.split(".").pop() ?? "mp3")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 5);
  const clave = `musica/${crypto.randomUUID()}.${extension || "mp3"}`;

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
