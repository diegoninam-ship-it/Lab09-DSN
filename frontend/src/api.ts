import axios from "axios";
import type { ImagenS3, RespuestaUploadUrl } from "./types";

// Sin VITE_API_URL, usa rutas relativas ("/api/...") resueltas contra el
// origen actual de la pagina. Funciona tanto detras del proxy de nginx en
// Docker (mismo origen) como en desarrollo nativo, donde VITE_API_URL puede
// seguir apuntando directo al backend en el puerto que uses.
const API_URL = import.meta.env.VITE_API_URL ?? "";

const cliente = axios.create({ baseURL: API_URL });

export async function solicitarUploadUrl(datos: {
  filename: string;
  contentType: string;
  sizeBytes: number;
}): Promise<RespuestaUploadUrl> {
  const { data } = await cliente.post<RespuestaUploadUrl>("/api/upload-url", datos);
  return data;
}

// PUT directo a S3 con la URL firmada: nunca pasa por el backend ni por
// credenciales de AWS (el navegador solo conoce la URL temporal).
export async function subirArchivoAS3(uploadUrl: string, archivo: File): Promise<void> {
  await axios.put(uploadUrl, archivo, {
    headers: { "Content-Type": archivo.type },
  });
}

export async function listarImagenes(): Promise<ImagenS3[]> {
  const { data } = await cliente.get<ImagenS3[]>("/api/images");
  return data;
}

export async function eliminarImagen(key: string): Promise<void> {
  await cliente.delete(`/api/images/${key}`);
}
