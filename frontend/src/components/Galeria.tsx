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
    return <p>Cargando galeria...</p>;
  }

  return (
    <div data-testid="galeria">
      {error && <p role="alert">{error}</p>}
      {imagenes.length === 0 && <p>No hay imagenes todavia.</p>}
      <ul>
        {imagenes.map((imagen) => (
          <li key={imagen.key}>
            <img src={imagen.url} alt={imagen.key} width={160} />
            <button onClick={() => manejarEliminar(imagen.key)} data-testid="boton-eliminar">
              Eliminar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
