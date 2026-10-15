import { Router } from "express";
import { guardarObjetoMock, obtenerObjetoMock } from "../mockS3.js";

// Imagen PNG de 1x1 valida, usada como respuesta fija del GET simulado.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

const router = Router();

// Simula el PUT directo a S3 con la URL "firmada" devuelta en modo mock.
router.put("/*key", (req, res) => {
  const segmentos = req.params.key;
  const key = Array.isArray(segmentos) ? segmentos.join("/") : segmentos;

  const trozos = [];
  req.on("data", (trozo) => trozos.push(trozo));
  req.on("end", () => {
    guardarObjetoMock(key, Buffer.concat(trozos).length);
    res.status(200).end();
  });
});

// Simula el GET de lectura, incluida la expiracion por TTL (query ?exp=).
router.get("/*key", (req, res) => {
  const segmentos = req.params.key;
  const key = Array.isArray(segmentos) ? segmentos.join("/") : segmentos;

  const objeto = obtenerObjetoMock(key);
  if (!objeto) {
    return res.status(404).json({ error: "no encontrado" });
  }

  const exp = req.query.exp ? Number(req.query.exp) : null;
  if (exp && Date.now() > exp) {
    return res.status(403).json({ error: "la url expiro" });
  }

  res.status(200).set("Content-Type", "image/png").send(PNG_1X1);
});

export default router;
