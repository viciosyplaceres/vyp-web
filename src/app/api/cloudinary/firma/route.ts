import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getSesion } from "@/lib/auth";
import { haySitioCloudinary } from "@/lib/almacenamiento";

/**
 * Emite una firma de subida de Cloudinary SOLO si quien la pide es un miembro
 * aprobado. Sin esta firma, Cloudinary rechaza la subida: es lo que hace cumplir
 * de verdad el "solo suben los miembros", porque el API Secret nunca sale de aquí.
 *
 * Sirve para:
 *  - galería: `tipo` "foto" | "video", con el año, va a vyp/galeria/<año>
 *  - avatar del perfil: `tipo` "avatar", va a vyp/avatares
 *  - diseños de camiseta: `tipo` "camiseta", con el año, va a vyp/camisetas/<año>
 *  - tickets de compra de una deuda: `tipo` "ticket", va a vyp/tickets
 *
 * La carpeta la decide SIEMPRE el servidor: el cliente no elige dónde escribe.
 */
export async function POST(request: Request) {
  const sesion = await getSesion();
  if (!sesion?.esMiembro) {
    return NextResponse.json(
      { error: "Solo los miembros de la peña pueden subir." },
      { status: 403 },
    );
  }

  // Antes de firmar nada: si ya casi no queda crédito gratuito, se corta aquí
  // y no en mitad de la subida. Nunca se debe pasar del plan Free de Cloudinary.
  const sitio = await haySitioCloudinary();
  if (!sitio.ok) {
    return NextResponse.json({ error: sitio.error }, { status: 507 });
  }

  const { anio, tipo } = await request.json().catch(() => ({}));

  let folder: string;

  if (tipo === "avatar") {
    folder = "vyp/avatares";
  } else if (tipo === "ticket") {
    folder = "vyp/tickets";
  } else if (tipo === "foto" || tipo === "video" || tipo === "camiseta") {
    const anioNum = Number(anio);
    if (!Number.isInteger(anioNum) || anioNum < 2010 || anioNum > 2100) {
      return NextResponse.json({ error: "Año no válido." }, { status: 400 });
    }
    folder = tipo === "camiseta" ? `vyp/camisetas/${anioNum}` : `vyp/galeria/${anioNum}`;
  } else {
    return NextResponse.json({ error: "Tipo no válido." }, { status: 400 });
  }

  const timestamp = Math.round(Date.now() / 1000);

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
