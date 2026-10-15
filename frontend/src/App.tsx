import { useState } from "react";
import { FormularioCarga } from "./components/FormularioCarga";
import { Galeria } from "./components/Galeria";

export default function App() {
  const [version, setVersion] = useState(0);

  return (
    <main>
      <h1>Galeria de imagenes</h1>
      <FormularioCarga onSubida={() => setVersion((v) => v + 1)} />
      <Galeria actualizarEn={version} />
    </main>
  );
}
