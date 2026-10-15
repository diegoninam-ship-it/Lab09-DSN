import "dotenv/config";

const REQUERIDAS = [
  "AWS_REGION",
  "S3_BUCKET",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "S3_KMS_KEY_ALIAS",
];

const faltantes = REQUERIDAS.filter((clave) => !process.env[clave]);
if (faltantes.length > 0) {
  throw new Error(
    `Faltan variables de entorno obligatorias: ${faltantes.join(", ")}`
  );
}

export const config = {
  awsRegion: process.env.AWS_REGION,
  s3Bucket: process.env.S3_BUCKET,
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  s3KmsKeyAlias: process.env.S3_KMS_KEY_ALIAS,
  port: Number(process.env.PORT ?? 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  maxSizeMb: Number(process.env.MAX_SIZE_MB ?? 5),
  uploadUrlTtlSegundos: Number(process.env.UPLOAD_URL_TTL_SEGUNDOS ?? 300),
  readUrlTtlSegundos: Number(process.env.READ_URL_TTL_SEGUNDOS ?? 900),
  s3Mock: process.env.S3_MOCK === "1",
};
