import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type KeyboardEvent } from "react";
import { solicitarUploadUrl, subirArchivoAS3 } from "../api";
import { TIPOS_PERMITIDOS, TAMANO_MAXIMO_BYTES } from "../types";

interface Props {
  onSubida: () => void;
}

export function FormularioCarga({ onSubida }: Props) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [arrastrando, setArrastrando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function limpiarPreview() {
    setPreviewUrl((anterior) => {
      if (anterior) URL.revokeObjectURL(anterior);
      return null;
    });
  }

  function validarYSeleccionar(seleccionado: File | null) {
    setError(null);
    setExito(null);
    setArchivo(null);
    limpiarPreview();

    if (!seleccionado) {
      return;
    }

    if (!TIPOS_PERMITIDOS.includes(seleccionado.type as (typeof TIPOS_PERMITIDOS)[number])) {
      setError("Solo se permiten imagenes JPG, PNG o WEBP.");
      return;
    }

    if (seleccionado.size > TAMANO_MAXIMO_BYTES) {
      setError("El archivo supera el tamano maximo de 5 MB.");
      return;
    }

    setArchivo(seleccionado);
    setPreviewUrl(URL.createObjectURL(seleccionado));
  }

  function manejarSeleccion(evento: ChangeEvent<HTMLInputElement>) {
    const seleccionado = evento.target.files?.[0] ?? null;
    validarYSeleccionar(seleccionado);
    evento.target.value = "";
  }

  function manejarDrop(evento: DragEvent<HTMLDivElement>) {
    evento.preventDefault();
    setArrastrando(false);
    if (subiendo) return;
    const seleccionado = evento.dataTransfer.files?.[0] ?? null;
    validarYSeleccionar(seleccionado);
  }

  function manejarDragOver(evento: DragEvent<HTMLDivElement>) {
    evento.preventDefault();
    if (!subiendo) setArrastrando(true);
  }

  function manejarDragLeave() {
    setArrastrando(false);
  }

  function abrirSelector() {
    if (!subiendo) inputRef.current?.click();
  }

  function manejarTecla(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      abrirSelector();
    }
  }

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault();
    if (!archivo) {
      setError("Selecciona una imagen primero.");
      return;
    }

    setSubiendo(true);
    setError(null);
    setExito(null);
    setProgreso(0);

    try {
      const { uploadUrl } = await solicitarUploadUrl({
        filename: archivo.name,
        contentType: archivo.type,
        sizeBytes: archivo.size,
      });

      await subirArchivoAS3(uploadUrl, archivo, setProgreso);

      setExito("Imagen subida correctamente.");
      setArchivo(null);
      limpiarPreview();
      onSubida();
    } catch {
      setError("No se pudo subir la imagen. Intenta de nuevo.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <form className="formulario-carga" onSubmit={manejarEnvio}>
      <div
        className={`zona-arrastre${arrastrando ? " zona-arrastre--activa" : ""}`}
        role="button"
        tabIndex={0}
        onClick={abrirSelector}
        onKeyDown={manejarTecla}
        onDragOver={manejarDragOver}
        onDragLeave={manejarDragLeave}
        onDrop={manejarDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={manejarSeleccion}
          disabled={subiendo}
          data-testid="input-archivo"
          className="zona-arrastre__input"
        />

        {previewUrl ? (
          <img src={previewUrl} alt={archivo?.name} className="zona-arrastre__preview" />
        ) : (
          <div className="zona-arrastre__prompt">
            <span className="zona-arrastre__icono" aria-hidden="true">
              📷
            </span>
            <p>Arrastra una imagen aqui o haz clic para elegir</p>
            <p className="zona-arrastre__ayuda">JPG, PNG o WEBP · hasta 5 MB</p>
          </div>
        )}
      </div>

      <button type="submit" disabled={!archivo || subiendo} data-testid="boton-subir" className="boton boton--primario">
        {subiendo ? "Subiendo..." : "Subir imagen"}
      </button>

      {subiendo && (
        <div
          className="barra-progreso"
          role="progressbar"
          aria-valuenow={progreso}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="barra-progreso__relleno" style={{ width: `${progreso}%` }} />
        </div>
      )}

      {error && (
        <div className="toast toast--error">
          <span className="toast__icono" aria-hidden="true">
            ⚠
          </span>
          <p role="alert" className="toast__mensaje">
            {error}
          </p>
        </div>
      )}

      {exito && (
        <div className="toast toast--exito">
          <span className="toast__icono" aria-hidden="true">
            ✓
          </span>
          <p className="toast__mensaje">{exito}</p>
        </div>
      )}
    </form>
  );
}
