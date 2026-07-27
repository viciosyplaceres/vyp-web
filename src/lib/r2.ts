import { S3Client } from "@aws-sdk/client-s3";

/**
 * Cliente S3 apuntando a R2. Las credenciales solo viven en el servidor:
 * el navegador nunca las ve, solo recibe URLs prefirmadas de corta vida.
 */
export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const R2_BUCKET = process.env.R2_BUCKET_NAME!;
