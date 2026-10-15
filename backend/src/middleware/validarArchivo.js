import { config } from "../config.js";

const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];

export function sanearNombreArchivo(nombre) {
  return nombre.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function validarSolicitudSubida(req, res, next) {
  const { filename, contentType, sizeBytes } = req.body ?? {};

  if (typeof filename !== "string" || filename.trim() === "") {
    return res.status(400).json({ error: "filename es obligatorio" });
  }

  if (!TIPOS_PERMITIDOS.includes(contentType)) {
    return res.status(400).json({ error: "contentType no permitido" });
  }

  if (typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return res.status(400).json({ error: "sizeBytes invalido" });
  }

  const maxBytes = config.maxSizeMb * 1024 * 1024;
  if (sizeBytes > maxBytes) {
    return res.status(400).json({ error: `el archivo supera ${config.maxSizeMb} MB` });
  }

  req.archivoSaneado = {
    filename: sanearNombreArchivo(filename),
    contentType,
    sizeBytes,
  };
  next();
}
