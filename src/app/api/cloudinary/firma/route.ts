import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getSesion } from "@/lib/auth";

/**
 * Emite una firma de subida de Cloudinary SOLO si quien la pide es un miembro
 * aprobado. Sin esta firma, Cloudinary rechaza la subida: es lo que hace cumplir
 * de verdad el "solo suben los miembros", porque el API Secret nunca sale de aquí.
 */
export async function POST(request: Request) {
  const sesion = await getSesion();
  if (!sesion?.esMiembro) {
    return NextResponse.json(
      { error: "Solo los miembros de la peña pueden subir." },
      { status: 403 },
    );
  }

  const { anio, tipo } = await request.json().catch(() => ({}));

  const anioNum = Number(anio);
  if (!Number.isInteger(anioNum) || anioNum < 2010 || anioNum > 2100) {
    return NextResponse.json({ error: "Año no válido." }, { status: 400 });
  }
  if (tipo !== "foto" && tipo !== "video") {
    return NextResponse.json({ error: "Tipo no válido." }, { status: 400 });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder = `vyp/galeria/${anioNum}`;

  // Los parámetros firmados son exactamente los que enviará el navegador.
  const paramsAFirmar = { folder, timestamp };

  const signature = cloudinary.utils.api_sign_request(
    paramsAFirmar,
    process.env.CLOUDINARY_API_SECRET!,
  );

  return NextResponse.json({
    signature,
    timestamp,
    folder,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  });
}
