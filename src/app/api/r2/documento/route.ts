import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "@/lib/r2";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSesion } from "@/lib/auth";

/**
 * Redirige a una URL prefirmada de lectura de un documento adjunto de tarea.
 *
 * A diferencia de la música (que es pública), esto es organización interna:
 * hay que ser miembro aprobado. Además se comprueba que la clave pedida
 * corresponde de verdad a una tarea existente, para que nadie use la ruta como
 * visor del resto del bucket.
 */
export async function GET(request: Request) {
  const sesion = await getSesion();
  if (!sesion?.esMiembro) {
    return NextResponse.json({ error: "Solo miembros." }, { status: 403 });
  }

  const clave = new URL(request.url).searchParams.get("clave");
  if (!clave) {
    return NextResponse.json({ error: "Falta la clave." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: tarea } = await supabase
    .from("tareas")
    .select("id")
    .eq("documento_url", clave)
    .maybeSingle();

  if (!tarea) {
    return NextResponse.json(
      { error: "Documento no encontrado." },
      { status: 404 },
    );
  }

  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: clave }),
    { expiresIn: 60 * 30 },
  );

  return NextResponse.redirect(url, 302);
}
