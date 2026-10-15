# Lab09 — Galería de imágenes sobre Amazon S3

GLAB-S09 — *Desarrollo de Soluciones en la Nube*, Tecsup (semana 9: Amazon S3).

Backend en Express que genera URLs presignadas de S3 (subida y lectura) y un
frontend en React que sube imágenes directo a S3 sin pasar credenciales de
AWS por el navegador. La especificación completa del laboratorio — alcance,
decisiones de diseño, contrato de la API y fases de desarrollo — está en
[CONTEXT.md](CONTEXT.md).

## Requisitos

- Node.js 20+ y npm.
- Para desarrollo contra AWS real: un bucket S3, un usuario IAM y una llave
  KMS ya creados (Etapa 2 del laboratorio, ver sección 10 de CONTEXT.md).

## Estructura

```
backend/   API Express (presigned URLs, listar/eliminar imágenes)
frontend/  React + Vite + TypeScript (formulario de carga, galería)
```

## Backend

```bash
cd backend
npm install
cp .env.example .env   # completar con las credenciales reales del usuario IAM
npm run dev             # http://localhost:3000
```

El backend se niega a arrancar si faltan `AWS_REGION`, `S3_BUCKET`,
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` o `S3_KMS_KEY_ALIAS` en `.env`
(ver `backend/src/config.js`). El resto de variables tiene valores por
defecto razonables — ver `.env.example`.

### Pruebas automatizadas (Vitest + Supertest)

```bash
cd backend
npm test           # una corrida
npm run coverage    # con cobertura
```

Estas pruebas **nunca llaman a AWS real**: `@aws-sdk/client-s3` se
intercepta con `aws-sdk-client-mock` y `@aws-sdk/s3-request-presigner` se
reemplaza con `vi.mock`. `vitest.config.js` inyecta credenciales ficticias
solo para los tests, independientes del `.env` real.

## Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

Por defecto apunta a `http://localhost:3000` (ver `VITE_API_URL`). Para
apuntar a otro backend, crear `frontend/.env.local` con
`VITE_API_URL=http://localhost:PUERTO`.

## El flag `S3_MOCK` — S3 simulado por proceso

`S3_MOCK=1` (variable de entorno del **backend**) hace que el proceso nunca
contacte a AWS, sin importar lo que tenga el `.env`:

- `GET /api/images`, `DELETE /api/images/:key` y la verificación previa a
  borrar operan contra un almacén en memoria (`backend/src/mockS3.js`) en
  vez del bucket real — ver `backend/src/s3Client.js`.
- `POST /api/upload-url` devuelve una URL propia del backend
  (`/mock-s3/<key>`) en lugar de una presigned URL real de S3
  (`backend/src/routes/mockS3.js` simula el `PUT` de subida y el `GET` de
  lectura, incluida la expiración por TTL vía `?exp=`).
- Esa ruta `/mock-s3` solo existe cuando `S3_MOCK=1`; en modo normal no se
  monta.

Es la base de las pruebas E2E (ver abajo) y puede usarse también para
levantar el backend a mano sin credenciales reales:

```bash
cd backend
S3_MOCK=1 AWS_REGION=us-east-1 S3_BUCKET=x AWS_ACCESS_KEY_ID=x \
  AWS_SECRET_ACCESS_KEY=x S3_KMS_KEY_ALIAS=alias/x npm run dev
```

(En Windows PowerShell: usar `$env:S3_MOCK = "1"` por variable, o el mismo
patrón que usa `frontend/playwright.config.ts`.)

## Pruebas E2E (Playwright)

```bash
cd frontend
npx playwright install chromium   # una sola vez
npm run e2e
```

`playwright.config.ts` levanta automáticamente el backend (puerto 3010, con
`S3_MOCK=1` y credenciales ficticias) y el frontend (`VITE_API_URL`
apuntando a ese backend) como `webServer`, corre las pruebas y los apaga al
terminar. **No requiere que la Etapa 2 (AWS) esté completa** ni usa
credenciales reales en ningún momento.

`frontend/e2e/01-flujo-completo.spec.ts` automatiza las 6 pruebas
obligatorias de la sección 12 de CONTEXT.md: subida de una imagen válida,
bloqueo de un archivo no permitido en el navegador, rechazo del backend a un
archivo de 10 MB, expiración de la URL de lectura (con un TTL acortado solo
para esta prueba), ausencia de credenciales AWS en el código servido al
navegador, y verificación de que la subida va directa al endpoint de
almacenamiento y no al backend.

## Las 6 pruebas manuales contra AWS real

Las pruebas automatizadas (Vitest y Playwright) nunca tocan el bucket real.
Las 6 pruebas manuales de la sección 12 de CONTEXT.md — que sí requieren el
bucket, el usuario IAM y el cifrado reales de la Etapa 2 — las ejecuta el
usuario en la Etapa 4, con capturas, informe y video como evidencia.
