export interface ImagenS3 {
  key: string;
  size: number;
  lastModified: string;
  url: string;
}

export interface RespuestaUploadUrl {
  uploadUrl: string;
  key: string;
}

export const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"] as const;
export const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024;
