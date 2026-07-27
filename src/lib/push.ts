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

type Aviso = {
  titulo: string;
  cuerpo: string;
  url?: string;
};

/**
 * Envía un aviso a todos los miembros salvo a quien lo provoca (no tiene
 * sentido avisarte de tu propio mensaje). Las suscripciones caducadas se
 * limpian solas: si el navegador responde 404/410, se borran.
 */
export async function avisarMiembros(aviso: Aviso, excluirUserId?: string) {
  if (!process.env.VAPID_PRIVATE_KEY) return;
  configurar();

  const supabase = createAdminClient();
  let consulta = supabase.from("push_subs").select("endpoint, p256dh, auth");
  if (excluirUserId) consulta = consulta.neq("user_id", excluirUserId);

  const { data: subs } = await consulta;
  if (!subs?.length) return;

  const payload = JSON.stringify(aviso);
  const caducadas: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
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
