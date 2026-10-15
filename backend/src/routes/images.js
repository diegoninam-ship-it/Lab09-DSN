import { Router } from "express";
import {
  ListObjectsV2Command,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "../s3Client.js";
import { config } from "../config.js";

const PREFIJO = "originales/";
const router = Router();

router.get("/", async (req, res) => {
  try {
    const salida = await s3Client.send(
      new ListObjectsV2Command({ Bucket: config.s3Bucket, Prefix: PREFIJO })
    );

    const objetos = (salida.Contents ?? []).filter((obj) => obj.Key !== PREFIJO);

    const imagenes = await Promise.all(
      objetos.map(async (obj) => {
        const url = await getSignedUrl(
          s3Client,
          new GetObjectCommand({ Bucket: config.s3Bucket, Key: obj.Key }),
          { expiresIn: config.readUrlTtlSegundos }
        );
        return {
          key: obj.Key,
          size: obj.Size,
          lastModified: obj.LastModified,
          url,
        };
      })
    );

    res.status(200).json(imagenes);
  } catch {
    res.status(500).json({ error: "No se pudo listar las imagenes" });
  }
});

router.delete("/*key", async (req, res) => {
  const segmentos = req.params.key;
  const key = Array.isArray(segmentos) ? segmentos.join("/") : segmentos;

  if (!key || !key.startsWith(PREFIJO)) {
    return res.status(400).json({ error: "key invalida" });
  }

  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: config.s3Bucket, Key: key }));
  } catch (error) {
    if (error.name === "NotFound") {
      return res.status(404).json({ error: "la imagen no existe" });
    }
    return res.status(500).json({ error: "No se pudo verificar la imagen" });
  }

  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: config.s3Bucket, Key: key }));
    res.status(200).json({ deleted: true });
  } catch {
    res.status(500).json({ error: "No se pudo eliminar la imagen" });
  }
});

export default router;
