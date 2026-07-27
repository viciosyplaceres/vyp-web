import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

let configurado = false;

function configurar() {
  if (configurado) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:alvaroviniloo@gmail.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configurado = true;
}

export type Aviso = {
  titulo: string;
  cuerpo: string;
  url?: string;
  /** Agrupa avisos del mismo tipo para no llenar la bandeja. */
  tag?: string;
};

type Destinatarios =
  | { tipo: "miembros"; excluir?: string }
  | { tipo: "admins"; excluir?: string }
  | { tipo: "usuario"; userId: string };

/**
 * Envía un aviso push y limpia por el camino las suscripciones muertas
 * (si el navegador responde 404/410, ese dispositivo ya no existe).
 *
 * Quién recibe qué se decide AQUÍ, en el servidor, cruzando `push_subs` con el
 * rol de cada perfil. Registrar un dispositivo no da derecho a recibirlo todo:
 * los avisos del chat solo van a miembros aprobados, y los de gestión solo a la
 * directiva.
 */
async function enviar(aviso: Aviso, destinatarios: Destinatarios) {
  if (!process.env.VAPID_PRIVATE_KEY) return;
  configurar();

  const supabase = createAdminClient();

  let consulta = supabase
    .from("push_subs")
    .select("endpoint, p256dh, auth, user_id, perfiles!inner(rol, aprobado)");

  if (destinatarios.tipo === "usuario") {
    consulta = consulta.eq("user_id", destinatarios.userId);
  } else {
    // Miembros y admins tienen que estar aprobados en ambos casos.
    consulta = consulta.eq("perfiles.aprobado", true);
    if (destinatarios.tipo === "admins") {
      consulta = consulta.eq("perfiles.rol", "admin");
    }
    if (destinatarios.excluir) {
      consulta = consulta.neq("user_id", destinatarios.excluir);
    }
  }

  const { data: subs } = await consulta;
  if (!subs?.length) return;

  const payload = JSON.stringify(aviso);
  const caducadas: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
      } catch (e) {
        const statusCode = (e as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          caducadas.push(s.endpoint);
        }
      }
    }),
  );

  if (caducadas.length) {
    await supabase.from("push_subs").delete().in("endpoint", caducadas);
  }
}

/**
 * Todas las llamadas se envuelven aquí: un fallo al notificar NUNCA debe
 * tumbar la acción que lo provocó. Si no se puede avisar, la foto ya está
 * subida y el mensaje ya está enviado; el aviso es lo secundario.
 */
async function seguro(fn: () => Promise<void>) {
  try {
    await fn();
  } catch {
    // silencioso a propósito
  }
}

/** A todos los miembros aprobados (opcionalmente menos quien lo provoca). */
export async function avisarMiembros(aviso: Aviso, excluir?: string) {
  await seguro(() => enviar(aviso, { tipo: "miembros", excluir }));
}

/** Solo a la directiva: altas nuevas, cambios de gestión. */
export async function avisarAdmins(aviso: Aviso, excluir?: string) {
  await seguro(() => enviar(aviso, { tipo: "admins", excluir }));
}

/** A una persona concreta: "ya te han aprobado". */
export async function avisarUsuario(userId: string, aviso: Aviso) {
  await seguro(() => enviar(aviso, { tipo: "usuario", userId }));
}
