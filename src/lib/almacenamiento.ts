import { v2 as cloudinary } from "cloudinary";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { r2, R2_BUCKET } from "@/lib/r2";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Límites reales de las cuentas gratuitas (verificados contra cada API).
 * El umbral es más bajo que el límite a propósito: deja margen para que
 * nadie se encuentre "a mitad de subir" cuando ya no cabe nada más.
 */
const CLOUDINARY_CREDITOS_LIMITE = 25;
const CLOUDINARY_UMBRAL = 0.9; // se bloquea al llegar al 90% (22,5 créditos)

const R2_BYTES_LIMITE = 10 * 1024 * 1024 * 1024; // 10 GB
const R2_UMBRAL = 0.9; // se bloquea al llegar al 90% (9 GB)

export type UsoCloudinary = {
  creditosUsados: number;
  creditosLimite: number;
  porcentaje: number;
  bloqueado: boolean;
};

export type UsoR2 = {
  bytesUsados: number;
  bytesLimite: number;
  porcentaje: number;
  objetos: number;
  bloqueado: boolean;
};

/** Créditos de Cloudinary consumidos este mes (almacenamiento + tráfico + transformaciones). */
export async function obtenerUsoCloudinary(): Promise<UsoCloudinary> {
  const uso = await cloudinary.api.usage();
  const creditosUsados = Number(uso.credits?.usage ?? 0);
  const porcentaje = creditosUsados / CLOUDINARY_CREDITOS_LIMITE;

  return {
    creditosUsados,
    creditosLimite: CLOUDINARY_CREDITOS_LIMITE,
    porcentaje,
    bloqueado: porcentaje >= CLOUDINARY_UMBRAL,
  };
}

/**
 * Suma el tamaño de todo lo que hay en el bucket de R2. Recorre el listado
 * completo (con paginación): a la escala de una peña son unos pocos cientos
 * de ficheros como mucho, así que es rápido y no hace falta cachearlo.
 */
export async function obtenerUsoR2(): Promise<UsoR2> {
  let bytesUsados = 0;
  let objetos = 0;
  let token: string | undefined;

  do {
    const res = await r2.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        ContinuationToken: token,
      }),
    );
    for (const obj of res.Contents ?? []) {
      bytesUsados += obj.Size ?? 0;
      objetos += 1;
    }
    token = res.NextContinuationToken;
  } while (token);

  const porcentaje = bytesUsados / R2_BYTES_LIMITE;

  return {
    bytesUsados,
    bytesLimite: R2_BYTES_LIMITE,
    porcentaje,
    objetos,
    bloqueado: porcentaje >= R2_UMBRAL,
  };
}

/** ¿Hay sitio para subir algo más a Cloudinary (fotos, vídeos, avatares)? */
export async function haySitioCloudinary(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const uso = await obtenerUsoCloudinary();
    if (uso.bloqueado) {
      return {
        ok: false,
        error:
          "Hemos llegado casi al límite de almacenamiento gratuito de fotos y vídeos. La directiva tiene que hacer sitio antes de que se pueda subir más.",
      };
    }
    return { ok: true };
  } catch {
    // Si la comprobación falla, se deja pasar: es mejor un fallo silencioso
    // de la comprobación que bloquear todas las subidas por un problema ajeno.
    return { ok: true };
  }
}

/** ¿Hay sitio para subir `bytesNuevos` más a R2 (música)? */
export async function haySitioR2(
  bytesNuevos: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const uso = await obtenerUsoR2();
    if ((uso.bytesUsados + bytesNuevos) / R2_BYTES_LIMITE >= R2_UMBRAL) {
      return {
        ok: false,
        error:
          "Hemos llegado casi al límite de almacenamiento gratuito de música. La directiva tiene que borrar algo antes de subir más.",
      };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}
