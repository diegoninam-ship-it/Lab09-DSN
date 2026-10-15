import { Router } from "express";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";
import { s3Client } from "../s3Client.js";
import { config } from "../config.js";
import { validarSolicitudSubida } from "../middleware/validarArchivo.js";

const router = Router();

router.post("/", validarSolicitudSubida, async (req, res) => {
  try {
    const { filename, contentType } = req.archivoSaneado;
    const key = `originales/${Date.now()}-${nanoid(12)}-${filename}`;

    const command = new PutObjectCommand({
      Bucket: config.s3Bucket,
      Key: key,
      ContentType: contentType,
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: config.s3KmsKeyAlias,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: config.uploadUrlTtlSegundos,
    });

    res.status(200).json({ uploadUrl, key });
  } catch {
    res.status(500).json({ error: "No se pudo generar la URL de subida" });
  }
});

export default router;
