import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSesion } from "@/lib/auth";

/** Registra el dispositivo del miembro para recibir avisos del chat. */
export async function POST(request: Request) {
  const sesion = await getSesion();
  if (!sesion?.esMiembro) {
    return NextResponse.json({ error: "Solo miembros." }, { status: 403 });
  }

  const sub = await request.json().catch(() => null);
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;

  if (
    typeof endpoint !== "string" ||
    typeof p256dh !== "string" ||
    typeof auth !== "string"
  ) {
    return NextResponse.json(
      { error: "Suscripción no válida." },
      { status: 400 },
    );
  }

  // Cliente admin a propósito: el endpoint es único, y si el mismo navegador lo
  // usó antes otra cuenta hay que reasignarlo. Ya está comprobado arriba que
  // quien llama es miembro aprobado, y el user_id se toma de la sesión, no del
  // cuerpo de la petición.
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("push_subs")
    .upsert(
      { user_id: sesion.userId, endpoint, p256dh, auth },
      { onConflict: "endpoint" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** Da de baja este dispositivo. */
export async function DELETE(request: Request) {
  const sesion = await getSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { endpoint } = await request.json().catch(() => ({}));
  if (typeof endpoint !== "string") {
    return NextResponse.json({ error: "Falta endpoint." }, { status: 400 });
  }

  // Acotado al propio usuario: nadie puede dar de baja el dispositivo de otro.
  const supabase = createAdminClient();
  await supabase
    .from("push_subs")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", sesion.userId);

  return NextResponse.json({ ok: true });
}
