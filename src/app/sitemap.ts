import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const SITIO = "https://www.viciosyplaceres.com";

// Recoge las nuevas fotos sin exigir un despliegue por cada subida.
export const revalidate = 3600;

type MediaSitemap = {
  id: string;
  anio: number;
  created_at: string;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const estaticas: MetadataRoute.Sitemap = [
    { url: SITIO },
    { url: `${SITIO}/galeria` },
    { url: `${SITIO}/musica` },
  ];

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await supabase
    .from("media")
    .select("id, anio, created_at")
    .order("created_at", { ascending: false });

  // Un fallo puntual de Supabase no debe convertir el sitemap entero en un 500.
  if (error || !data) return estaticas;

  const media = data as MediaSitemap[];
  const ultimaPorAnio = new Map<number, string>();
  for (const archivo of media) {
    if (!ultimaPorAnio.has(archivo.anio)) {
      ultimaPorAnio.set(archivo.anio, archivo.created_at);
    }
  }

  return [
    ...estaticas,
    ...[...ultimaPorAnio].map(([anio, ultimaModificacion]) => ({
      url: `${SITIO}/galeria/${anio}`,
      lastModified: new Date(ultimaModificacion),
    })),
    ...media.map((archivo) => ({
      url: `${SITIO}/galeria/${archivo.anio}/${archivo.id}`,
      lastModified: new Date(archivo.created_at),
    })),
  ];
}
