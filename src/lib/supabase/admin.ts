import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con service_role: se salta TODAS las políticas RLS.
 * Solo debe usarse en código de servidor y después de haber comprobado
 * a mano quién es el usuario. Nunca importar esto desde un componente cliente.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
