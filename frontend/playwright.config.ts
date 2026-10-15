import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, "../backend");

// Puerto distinto al de desarrollo (3000) para no chocar con un backend
// real que ya este corriendo en la maquina.
const BACKEND_PORT = 3010;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node src/server.js",
      cwd: backendDir,
      url: `${BACKEND_URL}/api/health`,
      // Nunca reutilizar un servidor ya existente en este puerto: si fuera
      // un backend real (credenciales reales), las pruebas tocarian AWS de
      // verdad en silencio. Siempre se levanta un proceso aislado y propio
      // con las credenciales ficticias de abajo.
      reuseExistingServer: false,
      env: {
        // Credenciales e identificadores ficticios: el backend nunca llama
        // a AWS de verdad en modo E2E (S3_MOCK=1 intercepta el S3Client).
        AWS_REGION: "us-east-1",
        S3_BUCKET: "bucket-e2e-ficticio",
        AWS_ACCESS_KEY_ID: "e2e-access-key",
        AWS_SECRET_ACCESS_KEY: "e2e-secret-key",
        S3_KMS_KEY_ALIAS: "alias/e2e-ficticio",
        PORT: String(BACKEND_PORT),
        CORS_ORIGIN: "http://localhost:5173",
        S3_MOCK: "1",
        UPLOAD_URL_TTL_SEGUNDOS: "300",
        // TTL corto para poder probar la expiracion de la URL de lectura
        // (prueba obligatoria 4, seccion 12) sin esperar 16 minutos reales.
        READ_URL_TTL_SEGUNDOS: "3",
      },
    },
    {
      command: "npm run dev",
      cwd: __dirname,
      url: "http://localhost:5173",
      // Idem: nunca reutilizar un dev server ya corriendo, para no heredar
      // un VITE_API_URL equivocado (ver el incidente documentado en la
      // seccion 3 de CONTEXT.md, fase F7).
      reuseExistingServer: false,
      env: {
        VITE_API_URL: BACKEND_URL,
      },
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
