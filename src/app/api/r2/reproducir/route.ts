import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "@/lib/r2";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Redirige a una URL prefirmada de lectura del audio guardado en R2.
 *
 * Escuchar es público (el requisito es que cualquiera pueda reproducir), pero
 * antes se comprueba que la clave pedida corresponde de verdad a una pista
 * registrada: así nadie puede usar esta ruta para hurgar en el resto del bucket.
 */
export async function GET(request: Request) {
  const clave = new URL(request.url).searchParams.get("clave");

  if (!clave) {
    return NextResponse.json({ error: "Falta la clave." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: pista } = await supabase
    .from("pistas")
    .select("id")
    .eq("origen", "r2")
    .eq("url", clave)
    .maybeSingle();

  if (!pista) {
    return NextResponse.json({ error: "Pista no encontrada." }, { status: 404 });
  }

  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: clave }),
    { expiresIn: 60 * 60 * 6 },
  );

  return NextResponse.redirect(url, 302);
}
