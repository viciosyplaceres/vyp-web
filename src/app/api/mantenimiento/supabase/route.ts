import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Vercel Cron lo llama cada día para mantener actividad de lectura en el
 * proyecto Free de Supabase. No devuelve datos ni modifica ninguna tabla.
 */
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const resultados = await Promise.all([
    supabase.from("media").select("id").limit(1),
    supabase.from("pistas").select("id").limit(1),
    supabase.from("comentarios").select("id").limit(1),
  ]);

  if (resultados.some(({ error }) => error)) {
    console.error("El mantenimiento de Supabase no pudo completar una lectura.");
    return Response.json({ ok: false }, { status: 502 });
  }

  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
