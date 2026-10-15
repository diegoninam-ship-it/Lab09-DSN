import { useState } from "react";
import { FormularioCarga } from "./components/FormularioCarga";
import { Galeria } from "./components/Galeria";

export default function App() {
  const [version, setVersion] = useState(0);

  return (
    <div className="pagina">
      <header className="cabecera">
        <h1>Galeria de imagenes</h1>
        <p className="cabecera__subtitulo">Sube, organiza y comparte tus fotos de forma segura</p>
      </header>
      <main className="contenido">
        <FormularioCarga onSubida={() => setVersion((v) => v + 1)} />
        <Galeria actualizarEn={version} />
      </main>
    </div>
  );
}
