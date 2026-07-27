/**
 * Configura CORS en el bucket de R2.
 *
 * POR QUÉ EXISTE ESTE FICHERO: la música se sube desde el navegador
 * directamente a R2 con una URL prefirmada (el fichero no pasa por el servidor
 * de Next, que tiene un límite de tamaño de petición). Eso es una petición
 * entre dominios distintos, así que el navegador manda antes un "preflight"
 * OPTIONS. Si el bucket no tiene política CORS, R2 no responde con
 * `Access-Control-Allow-Origin` y el navegador cancela la subida:
 *
 *   "has been blocked by CORS policy: No 'Access-Control-Allow-Origin'
 *    header is present on the requested resource"
 *
 * Esta configuración vive en el bucket, NO en el código, así que hay que
 * volver a lanzarla si algún día se recrea el bucket o se añade un dominio.
 *
 * Uso (con las variables de .env.local cargadas):
 *   node --env-file=.env.local scripts/configurar-cors-r2.mjs
 */
import {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} from "@aws-sdk/client-s3";

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
} = process.env;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error(
    "Faltan variables de R2. Lanza con: node --env-file=.env.local scripts/configurar-cors-r2.mjs",
  );
  process.exit(1);
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// Los dos orígenes son necesarios: el dominio responde con y sin "www", y para
// el navegador son sitios distintos.
const ORIGENES = [
  "https://viciosyplaceres.com",
  "https://www.viciosyplaceres.com",
  "http://localhost:3000",
];

await r2.send(
  new PutBucketCorsCommand({
    Bucket: R2_BUCKET_NAME,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: ORIGENES,
          // PUT para subir; GET y HEAD para que el reproductor pueda leer el
          // audio y pedir trozos al mover la barra de progreso.
          AllowedMethods: ["PUT", "GET", "HEAD"],
          AllowedHeaders: ["*"],
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }),
);

const actual = await r2.send(new GetBucketCorsCommand({ Bucket: R2_BUCKET_NAME }));
console.log("CORS aplicado al bucket", R2_BUCKET_NAME);
console.log(JSON.stringify(actual.CORSRules, null, 2));
console.log(
  "\nOjo: tarda unos segundos en propagarse por el edge de Cloudflare.\n" +
    "Si justo después ves un 403 en el preflight, espera y reintenta.",
);
