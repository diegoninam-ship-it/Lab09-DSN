import { useState, type ChangeEvent, type FormEvent } from "react";
import { solicitarUploadUrl, subirArchivoAS3 } from "../api";
import { TIPOS_PERMITIDOS, TAMANO_MAXIMO_BYTES } from "../types";

interface Props {
  onSubida: () => void;
}

export function FormularioCarga({ onSubida }: Props) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  function manejarSeleccion(evento: ChangeEvent<HTMLInputElement>) {
    const seleccionado = evento.target.files?.[0] ?? null;
    setError(null);
    setArchivo(null);

    if (!seleccionado) {
      return;
    }

    if (!TIPOS_PERMITIDOS.includes(seleccionado.type as (typeof TIPOS_PERMITIDOS)[number])) {
      evento.target.value = "";
      setError("Solo se permiten imagenes JPG, PNG o WEBP.");
      return;
    }

    if (seleccionado.size > TAMANO_MAXIMO_BYTES) {
      evento.target.value = "";
      setError("El archivo supera el tamano maximo de 5 MB.");
      return;
    }

    setArchivo(seleccionado);
  }

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault();
    if (!archivo) {
      setError("Selecciona una imagen primero.");
      return;
    }

    setSubiendo(true);
    setError(null);

    try {
      const { uploadUrl } = await solicitarUploadUrl({
        filename: archivo.name,
        contentType: archivo.type,
        sizeBytes: archivo.size,
      });

      await subirArchivoAS3(uploadUrl, archivo);

      setArchivo(null);
      onSubida();
    } catch {
      setError("No se pudo subir la imagen. Intenta de nuevo.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <form onSubmit={manejarEnvio}>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={manejarSeleccion}
        disabled={subiendo}
        data-testid="input-archivo"
      />
      <button type="submit" disabled={!archivo || subiendo} data-testid="boton-subir">
        {subiendo ? "Subiendo..." : "Subir imagen"}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
