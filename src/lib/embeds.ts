export type OrigenPista = "r2" | "mixcloud" | "soundcloud";

/**
 * Detecta si una URL es de Mixcloud o SoundCloud y calcula su URL de embed.
 * Devuelve null si no es ninguna de las dos (entonces no se acepta como enlace).
 */
export async function analizarEnlaceMusica(
  urlTexto: string,
): Promise<
  { origen: Exclude<OrigenPista, "r2">; url: string; embedUrl: string } | null
> {
  let url: URL;
  try {
    url = new URL(urlTexto.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  let host = url.hostname.replace(/^www\./, "").toLowerCase();

  // Los enlaces que comparte SoundCloud desde su app son cortos y redirigen a
  // una pista. El reproductor oficial no admite esa URL intermedia, así que se
  // resuelve en el servidor antes de guardarla.
  if (host === "on.soundcloud.com") {
    try {
      const respuesta = await fetch(url, { redirect: "follow" });
      url = new URL(respuesta.url);
      host = url.hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return null;
    }
  }

  const limpia = `https://${host}${url.pathname}`;

  if (host === "mixcloud.com" || host.endsWith(".mixcloud.com")) {
    return {
      origen: "mixcloud",
      url: limpia,
      embedUrl: `https://www.mixcloud.com/widget/iframe/?hide_cover=1&light=0&feed=${encodeURIComponent(
        url.pathname,
      )}`,
    };
  }

  if (host === "soundcloud.com" || host.endsWith(".soundcloud.com")) {
    return {
      origen: "soundcloud",
      url: limpia,
      embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(
        limpia,
      )}&color=%23ffffff&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`,
    };
  }

  return null;
}

/** Segundos → "1:04:32" o "4:32" */
export function formatearDuracion(segundos: number | null | undefined): string {
  if (!segundos || segundos < 0) return "";
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = Math.floor(segundos % 60);
  const dosDigitos = (n: number) => String(n).padStart(2, "0");
  return h > 0
    ? `${h}:${dosDigitos(m)}:${dosDigitos(s)}`
    : `${m}:${dosDigitos(s)}`;
}
