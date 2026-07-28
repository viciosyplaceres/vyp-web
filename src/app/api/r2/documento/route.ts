import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "@/lib/r2";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSesion } from "@/lib/auth";
import { esClaveDocumento } from "@/lib/r2-claves";

/**
 * Redirige a una URL prefirmada de lectura de un documento adjunto de tarea o
 * de un artículo de la lista de la compra.
 *
 * A diferencia de la música (que es pública), esto es organización interna:
 * hay que ser miembro aprobado. Además se comprueba que la clave pedida
 * corresponde de verdad a una tarea o un artículo existente, para que nadie
 * use la ruta como visor del resto del bucket.
 */
export async function GET(request: Request) {
  const sesion = await getSesion();
  if (!sesion?.esMiembro) {
    return NextResponse.json({ error: "Solo miembros." }, { status: 403 });
  }

  const clave = new URL(request.url).searchParams.get("clave");
  if (!esClaveDocumento(clave)) {
    return NextResponse.json({ error: "Clave no válida." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const [resultadoTarea, resultadoCompra] = await Promise.all([
    supabase
      .from("tareas")
      .select("id")
      .eq("documento_url", clave)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("lista_compra")
      .select("id")
      .eq("documento_url", clave)
      .limit(1)
      .maybeSingle(),
  ]);

  if (resultadoTarea.error || resultadoCompra.error) {
    return NextResponse.json(
      { error: "No se pudo comprobar el documento." },
      { status: 500 },
    );
  }

  if (!resultadoTarea.data && !resultadoCompra.data) {
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
