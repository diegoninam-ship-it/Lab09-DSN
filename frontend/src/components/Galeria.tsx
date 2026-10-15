import { useEffect, useState } from "react";
import { eliminarImagen, listarImagenes } from "../api";
import type { ImagenS3 } from "../types";

interface Props {
  actualizarEn: number;
}

export function Galeria({ actualizarEn }: Props) {
  const [imagenes, setImagenes] = useState<ImagenS3[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    setCargando(true);

    listarImagenes()
      .then((datos) => {
        if (activo) setImagenes(datos);
      })
      .catch(() => {
        if (activo) setError("No se pudieron cargar las imagenes.");
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [actualizarEn]);

  async function manejarEliminar(key: string) {
    try {
      await eliminarImagen(key);
      setImagenes((previas) => previas.filter((imagen) => imagen.key !== key));
    } catch {
      setError("No se pudo eliminar la imagen.");
    }
  }

  if (cargando) {
    return (
      <div className="galeria-estado" data-testid="galeria">
        <span className="spinner" aria-hidden="true" />
        <p>Cargando galeria...</p>
      </div>
    );
  }

  return (
    <div data-testid="galeria">
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

      {imagenes.length === 0 ? (
        <div className="galeria-estado">
          <span className="galeria-estado__icono" aria-hidden="true">
            🖼
          </span>
          <p>No hay imagenes todavia.</p>
        </div>
      ) : (
        <ul className="galeria-grid">
          {imagenes.map((imagen) => (
            <li key={imagen.key} className="galeria-item">
              <img src={imagen.url} alt={imagen.key} className="galeria-item__imagen" />
              <button
                onClick={() => manejarEliminar(imagen.key)}
                data-testid="boton-eliminar"
                className="galeria-item__eliminar"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
