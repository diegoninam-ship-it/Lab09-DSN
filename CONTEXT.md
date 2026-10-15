# CONTEXT.md — Lab09: Galería de imágenes sobre Amazon S3 (IAM, cifrado, presigned URLs)

> ## Instrucciones para el agente (léelas antes que nada)
>
> 1. Este archivo es la **especificación completa y la fuente de verdad** del proyecto. Léelo entero antes de cualquier tarea.
> 2. Tu alcance es **solo la Etapa 3 (Desarrollo + pruebas automatizadas)** del Ejercicio 4. **Nunca toques AWS**: no ejecutes `aws` CLI contra la cuenta real, no uses credenciales reales, no crees ni borres recursos.
> 3. El bucket, el usuario IAM y sus credenciales **ya existen** cuando empieces — los crea el usuario en la Etapa 2, manual. Tu `.env` de desarrollo usa esas credenciales reales, pero tus **pruebas automatizadas nunca llaman a AWS de verdad**: todas corren contra un cliente S3 simulado (`aws-sdk-client-mock`).
> 4. Trabaja por **fases (F1–F6)**. Al cerrar cada una: pruebas en verde, commit, push, actualizar las secciones 3 y 15, reportar y **esperar confirmación** antes de seguir.
> 5. Si algo es ambiguo o crees que una decisión debería cambiar, **detente y pregunta**. No modifiques la sección 13 (decisiones) sin aprobación.
> 6. **Nunca versiones secretos** (`.env` con el Access Key/Secret real) ni los imprimas en logs o reportes.

---

## 1. Resumen

| Campo | Valor |
|---|---|
| Laboratorio | GLAB-S09 — *Desarrollo de Soluciones en la Nube*, Tecsup (semana 9: Amazon S3) |
| Caso | Startup de fotografía: repositorio de imágenes en S3, con control de acceso, cifrado y una app web que sube/lista/elimina imágenes sin exponer credenciales |
| Alcance | Ejercicios 1–3 (fundamentos, seguridad/IAM/cifrado, versionado/ciclo de vida) **+ Parte D opcional (CRR)** manuales; Ejercicio 4 (app web con presigned URLs) desarrollado y probado por el agente |
| Repositorio | https://github.com/diegoninam-ship-it/Lab09-DSN.git |
| Ruta local | `C:\Lab09-DSN` |
| Autor | Diego Nina |
| Apellido / fecha para nombres de recursos | `nina` / `20261014` |

---

## 2. Etapas y responsables

| # | Etapa | Contenido | Responsable | Estado |
|---|---|---|---|---|
| 1 | Planificación | Alcance, stack, decisiones | Chat | ✅ Cerrada (2026-10-14) |
| 2 | **AWS: fundamentos y seguridad** (Ejercicios 1–3 + Parte D) | Bucket, IAM, cifrado, HTTPS forzado, versionado, lifecycle, CRR | **Usuario**, con guía por chat | ⏳ Pendiente — **debe completarse antes de F1** |
| 3 | Desarrollo + pruebas automatizadas (Ejercicio 4) | Backend, frontend, suite Vitest/Supertest | **Agente** | ⏳ Pendiente |
| 4 | Evidencia y entregables | 6 pruebas manuales, capturas, informe PDF, video, limpieza | **Usuario** | ⏳ Pendiente |

**Orden crítico, distinto a labs anteriores:** aquí la Etapa 2 (AWS) va **antes** que el desarrollo, porque la aplicación se conecta a un bucket real desde el primer endpoint — no hay entorno local simulado para S3.

---

## 3. Estado actual

**Última actualización:** 2026-10-14

- Planificación cerrada. **Sigue la Etapa 2 (AWS)**, manual, guiada por chat — ver sección 10.
- El agente **no debe iniciar la fase F1** hasta que la sección 10 esté marcada como completa y el usuario confirme que el `.env` con las credenciales reales está listo (sección 11.4).

---

## 4. Infraestructura AWS — resumen de lo que debe existir antes de F1

| Recurso | Nombre / valor |
|---|---|
| Bucket principal | `lab-09-nina-20261014` (región `us-east-1`) |
| Carpetas lógicas | `originales/`, `miniaturas/`, `temporal/` |
| Usuario IAM | `app-imagenes-user` (sin consola, con Access Key + Secret Access Key) |
| Política IAM (adjunta al usuario) | Mínimo privilegio: `GetObject`, `PutObject`, `DeleteObject`, `ListBucket` + permisos KMS (sección 10.3) |
| Política de bucket | Deniega sin HTTPS (`aws:SecureTransport: false`) |
| Cifrado por defecto | **SSE-KMS** con CMK propia (alias `alias/lab09-nina-imagenes`) |
| Versionado | Activado |
| Regla de lifecycle | `regla-imagenes-antiguas` (detalle en 10.5) |
| CORS del bucket | `PUT`, `GET` desde `http://localhost:5173` (Vite dev) |
| Bucket de respaldo (CRR) | `lab-09-nina-20261014-drp` en `us-west-2`, versionado activado |
| Rol de replicación | `lab09-replicacion-role` |

---

## 5. Actores

No hay roles dentro de la aplicación — es de un solo tipo de usuario (el fotógrafo). La única identidad relevante es el usuario IAM `app-imagenes-user`, usado **solo por el backend**, nunca por el navegador.

---

## 6. Endpoints y contrato (Ejercicio 4)

Base: `http://localhost:3000`. Todas las respuestas en JSON. El frontend corre en `http://localhost:5173` (Vite dev).

| Método y ruta | Body / parámetros | Respuesta |
|---|---|---|
| `POST /api/upload-url` | `{ "filename": string, "contentType": string, "sizeBytes": number }` | `200 { "uploadUrl": string, "key": string }` · `400` tipo no permitido o archivo > 5 MB |
| `GET /api/images` | — | `200 [{ "key", "size", "lastModified", "url" }]` (urls de lectura, 15 min) |
| `DELETE /api/images/:key(*)` | `key` puede contener `/` (prefijo `originales/`) | `200 { "deleted": true }` · `404` si no existe |
| `GET /api/health` | — | `200 { "estado": "ok" }` — **no contacta a S3**, solo confirma que el proceso responde |

### Reglas de validación (backend, re-validadas aunque el frontend ya filtre)

- `contentType` ∈ `{image/jpeg, image/png, image/webp}`.
- `sizeBytes` ≤ 5 MB (`5 * 1024 * 1024` bytes).
- `filename` saneado: solo `[a-zA-Z0-9._-]`, el resto se reemplaza por `_`.
- La `key` final: `originales/<timestamp>-<6 bytes hex aleatorios>-<nombre saneado>` — nunca usar el nombre del usuario tal cual, para evitar colisiones y *path traversal* (`../`).
- `PutObjectCommand` para la URL de subida incluye `ServerSideEncryption: "aws:kms"` y `SSEKMSKeyId` (el alias de la CMK), consistente con el cifrado por defecto del bucket (sección 10.3).

### Expiración de las presigned URLs

- Subida (`PutObjectCommand`): **300 s** (5 min).
- Lectura (`GetObjectCommand`): **900 s** (15 min).

---

## 7. Stack y versiones

Verificadas el 2026-10-14 en npm.

### Backend (JavaScript, Node ESM — ver nota)

| Paquete | Versión | Uso |
|---|---|---|
| express | 5.3.0 | Servidor HTTP |
| cors | 2.8.6 | CORS para el origen del frontend |
| dotenv | 18.0.8 | Variables de entorno |
| @aws-sdk/client-s3 | 3.1151.0 | Cliente S3 |
| @aws-sdk/s3-request-presigner | 3.1151.0 | Generación de presigned URLs |
| helmet | 8.3.0 | Cabeceras de seguridad HTTP |
| express-rate-limit | 8.7.1 | Limitar abuso de `/api/upload-url` (pregunta 51 del enunciado) |
| nanoid | 6.0.2 | Sufijo aleatorio de la `key` (sustituye a `crypto.randomBytes` del ejemplo, misma idea) |

### Backend — pruebas

| Paquete | Versión |
|---|---|
| vitest | 5.0.4 |
| @vitest/coverage-v8 | 5.0.4 |
| supertest | 7.3.1 |
| aws-sdk-client-mock | 4.1.0 |
| aws-sdk-client-mock-vitest | 8.0.0 |

### Frontend

| Paquete | Versión |
|---|---|
| react / react-dom | 19.3.0 |
| vite / @vitejs/plugin-react | 8.3.4 / 6.1.2 |
| typescript | 7.0.2 (si da fricción con Vite, usar la última estable compatible y documentarlo) |
| axios | 1.20.0 |

### Frontend — E2E

| Paquete | Versión |
|---|---|
| @playwright/test | 1.64.1 |

**Nota sobre el lenguaje del backend:** el código de referencia del enunciado está en JavaScript plano (no TypeScript). Para no desviarse del ejemplo dado por el docente, el backend se escribe en **JavaScript (ESM, `"type": "module"` en `package.json`)**; el frontend sí usa TypeScript, por ser la elección explícita del usuario. Si el agente prefiere TypeScript en el backend por consistencia, debe preguntarlo antes de F1 — no decidirlo solo.

---

## 8. Estructura del repositorio

```
Lab09-DSN/
├── CONTEXT.md
├── README.md
├── .gitignore                  # .env, node_modules/, dist/, coverage/, test-results/, playwright-report/
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── vitest.config.js
│   ├── src/
│   │   ├── app.js              # crea la app Express (exportable, para supertest)
│   │   ├── server.js           # arranca app.js con app.listen()
│   │   ├── config.js           # valida variables de entorno al arrancar
│   │   ├── s3Client.js         # instancia única de S3Client
│   │   ├── middleware/
│   │   │   └── validarArchivo.js
│   │   └── routes/
│   │       ├── salud.js
│   │       ├── uploadUrl.js
│   │       └── images.js
│   └── tests/
│       ├── uploadUrl.test.js
│       ├── images.test.js
│       └── validaciones.test.js
└── frontend/
    ├── package.json
    ├── vite.config.ts          # puerto 5173 (strictPort)
    ├── tsconfig.json
    ├── index.html
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── api.ts               # cliente axios hacia el backend
    │   ├── components/
    │   │   ├── FormularioCarga.tsx
    │   │   └── Galeria.tsx
    │   └── types.ts
    └── e2e/
        └── 01-flujo-completo.spec.ts
```

---

## 9. Configuración y variables de entorno

### Backend (`.env`, nunca versionado)

| Variable | Obligatoria | Validación |
|---|---|---|
| `AWS_REGION` | Sí | `us-east-1` |
| `S3_BUCKET` | Sí | `lab-09-nina-20261014` |
| `AWS_ACCESS_KEY_ID` | Sí | Del usuario `app-imagenes-user` |
| `AWS_SECRET_ACCESS_KEY` | Sí | Ídem |
| `S3_KMS_KEY_ALIAS` | Sí | `alias/lab09-nina-imagenes` — usado en `SSEKMSKeyId` al generar la URL de subida |
| `PORT` | No (default `3000`) | Entero |
| `CORS_ORIGIN` | No (default `http://localhost:5173`) | — |
| `MAX_SIZE_MB` | No (default `5`) | Entero > 0 |
| `UPLOAD_URL_TTL_SEGUNDOS` | No (default `300`) | — |
| `READ_URL_TTL_SEGUNDOS` | No (default `900`) | — |

El backend **se niega a arrancar** si `AWS_REGION`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` o `S3_KMS_KEY_ALIAS` faltan.

### Frontend

| Variable | Default |
|---|---|
| `VITE_API_URL` | `http://localhost:3000` |

---

## 10. Etapa 2 — AWS: fundamentos y seguridad (manual, referencia para la guía por chat)

Esta sección documenta **qué** debe quedar construido; los pasos de consola exactos se dan por chat, fuera de este archivo, igual que en el Lab07/08.

### 10.1 Ejercicio 1 — Bucket y estructura

- Bucket `lab-09-nina-20261014`, región `us-east-1`, **Block all public access activado** (no se desactiva en ningún punto del laboratorio).
- Carpetas `originales/`, `miniaturas/`, `temporal/`.
- Subir 3 imágenes de prueba a `originales/` (consola) y validar los comandos de CLI (`aws s3 ls`, `cp`, `sync`).

### 10.2 Ejercicio 2 — IAM y HTTPS

- Usuario `app-imagenes-user`, sin acceso a consola, con Access Key.
- Política personalizada adjunta **directamente** al usuario (sin grupo), con las 4 acciones del enunciado — ver 10.3 para la versión ampliada con KMS.
- Política de bucket que deniega todo sin `aws:SecureTransport`.
- Validación con un segundo perfil de CLI (`--profile app-user`): operaciones permitidas funcionan, `delete-bucket` falla con `AccessDenied`.

### 10.3 Política IAM ampliada (por usar SSE-KMS con CMK propia)

La política del enunciado alcanza para SSE-S3, pero **no para SSE-KMS con una llave gestionada por el cliente**: sin permisos sobre la clave, todo `PutObject`/`GetObject` fallaría con `AccessDenied` aunque la política S3 esté bien. Se agrega este bloque:

```json
{
  "Sid": "PermitirUsoDeLaLlaveKMS",
  "Effect": "Allow",
  "Action": ["kms:Decrypt", "kms:GenerateDataKey"],
  "Resource": "arn:aws:kms:us-east-1:<ID_DE_CUENTA>:key/<ID_DE_LA_LLAVE>"
}
```

### 10.4 Ejercicio 2, Parte C — Cifrado

- Crear una **CMK** en KMS (alias `alias/lab09-nina-imagenes`).
- Configurar el **cifrado por defecto del bucket** en SSE-KMS con esa llave.
- Verificar subiendo un objeto y revisando `Server-side encryption: aws:kms` en sus propiedades.

### 10.5 Ejercicio 3 — Versionado y lifecycle

- Versionado activado; demostrar 3 versiones de un mismo archivo, `delete marker`, restauración.
- Regla `regla-imagenes-antiguas`, prefijo `originales/`:
  - Versiones actuales → Standard-IA a 30 días, Glacier Instant Retrieval a 90 días.
  - Versiones no actuales → Glacier Deep Archive a 60 días, expiración a 365 días.
  - Eliminar *delete markers* expirados: activado.

### 10.6 Parte D — CRR (incluida en el alcance)

- Segundo bucket `lab-09-nina-20261014-drp` en `us-west-2`, versionado activado.
- Rol `lab09-replicacion-role` (confianza: `s3.amazonaws.com`), con permisos de lectura de versiones en el origen y de réplica en el destino.
- **Detalle que el enunciado no menciona y es obligatorio con SSE-KMS:** la regla de replicación debe declarar explícitamente `SourceSelectionCriteria.SseKmsEncryptedObjects.Status = Enabled` y un `EncryptionConfiguration.ReplicaKmsKeyID` (una CMK **en la región destino**, `us-west-2` — las llaves de KMS no cruzan regiones). Sin esto, los objetos cifrados con KMS **no se replican**, aunque la regla esté "activa".

### 10.7 CORS del bucket

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedOrigins": ["http://localhost:5173"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

### 10.8 Checklist de salida de la Etapa 2

- [ ] Bucket + carpetas + 3 imágenes de prueba
- [ ] Usuario IAM + política ampliada (10.3) + Access Key generado
- [ ] Política de bucket (HTTPS) aplicada y validada
- [ ] CMK creada, cifrado por defecto en SSE-KMS
- [ ] Versionado activo, delete marker demostrado
- [ ] Lifecycle rule creada
- [ ] CORS aplicado
- [ ] Bucket de respaldo + rol de replicación + CRR funcionando con KMS
- [ ] `.env` del backend completado con las credenciales reales (fuera del repositorio)

---

## 11. Etapa 3 — Desarrollo (agente)

### 11.1 Reglas de seguridad para el código

- El **frontend nunca** recibe ni envía Access Key/Secret — solo consume `POST /api/upload-url` y hace el `PUT` final directo a la URL firmada.
- El backend lee las credenciales **solo** de variables de entorno.
- Toda validación de tipo/tamaño del frontend se **repite** en el backend (el enunciado lo exige explícitamente: "las validaciones del navegador se pueden saltar fácilmente").
- Rate limiting en `/api/upload-url` (pregunta 51 del enunciado): máx. 20 peticiones/minuto por IP (`express-rate-limit`).
- `helmet()` activo en toda la app.

### 11.2 Fases

| Fase | Contenido |
|---|---|
| F1 | Estructura del repo, `package.json` (backend y frontend), `.env.example`, `.gitignore`, `config.js` con validación de arranque |
| F2 | `s3Client.js`, `POST /api/upload-url` con validación y saneo de `filename`, pruebas con `aws-sdk-client-mock` |
| F3 | `GET /api/images`, `DELETE /api/images/:key`, `GET /api/health`, rate limiting, helmet |
| F4 | Frontend: `FormularioCarga` (validación de tipo/tamaño, `PUT` directo a S3), `Galeria` (listar, previsualizar, eliminar) |
| F5 | Pruebas E2E con Playwright de las 6 pruebas obligatorias (sección 12), usando el backend real pero **sin tocar S3** — ver 11.3 |
| F6 | `README.md` con instrucciones de instalación, y cierre |

### 11.3 Cómo probar sin tocar AWS

- **Backend (Vitest + Supertest):** `app.js` exporta la app de Express sin llamar a `listen()`. `@aws-sdk/client-s3` se reemplaza con `aws-sdk-client-mock` en cada prueba — nunca se usan credenciales reales en la suite automatizada, aunque el `.env` de desarrollo sí las tenga.
- **E2E (Playwright, F5):** corre contra el backend real **en modo de prueba**, con un S3 simulado a nivel de proceso (mock del SDK inyectado por una bandera de entorno `S3_MOCK=1` que hace que `s3Client.js` use un cliente falso con objetos en memoria). El agente debe documentar esta bandera en el `README.md`. Las pruebas E2E **no requieren que la Etapa 2 esté completa** para poder correr en CI o en la máquina del agente — es una capa de prueba independiente del bucket real.
- Las **6 pruebas manuales** del enunciado (sección 12) sí requieren el bucket real y las hace el usuario en la Etapa 4, no el agente.

### 11.4 Prerrequisito antes de F1

El usuario confirma: Etapa 2 completa (checklist 10.8) y `.env` del backend con las credenciales reales, listo en `C:\Lab09-DSN\backend\.env` (no commiteado).

---

## 12. Las 6 pruebas obligatorias (Etapa 4, usuario)

1. Subir una imagen JPG válida → aparece en la galería.
2. Intentar subir un `.exe` o `.pdf` → el frontend lo bloquea.
3. Intentar subir un archivo de 10 MB → el backend lo rechaza (`400`).
4. Copiar una URL de visualización y abrirla 16 minutos después → debe expirar.
5. Inspeccionar el código del frontend en el navegador → sin credenciales de AWS.
6. Revisar las solicitudes de red → el archivo va directo al endpoint de S3, no al backend.

Evidencia: capturas de cada una + el informe PDF con las respuestas a las preguntas de análisis de los 4 ejercicios + video (máx. 5 min) de la app funcionando.

---

## 13. Registro de decisiones

| # | Decisión | Motivo |
|---|---|---|
| D1 | Stack: Node.js + Express + AWS SDK v3 (backend en JS) | El código de referencia del enunciado ya está en ese stack |
| D2 | Frontend: React 19 + Vite + TypeScript, adaptando la lógica del ejemplo | Consistencia con el stack habitual del usuario |
| D3 | Alcance: obligatorio + SSE-KMS avanzado + CRR (Parte D) | Elección del usuario |
| D4 | Cifrado por defecto final: SSE-KMS con CMK propia (no SSE-S3) | Consecuencia directa de D3 |
| D5 | Política IAM ampliada con permisos de KMS (10.3) | Sin ellos, SSE-KMS con CMK rompe todo `Put`/`Get` — hueco no cubierto por la política del enunciado |
| D6 | CRR con `ReplicaKmsKeyID` y `SseKmsEncryptedObjects.Status=Enabled` explícitos | Sin esto, los objetos cifrados con KMS no se replican — detalle no mencionado por el enunciado |
| D7 | Suite automatizada (Vitest + Supertest + aws-sdk-client-mock) además de las 6 pruebas manuales | Elección del usuario, igual rigor que labs anteriores |
| D8 | Etapa 2 (AWS) antes que la Etapa 3 (desarrollo) | La app depende de un bucket y credenciales reales desde el primer endpoint |
| D9 | Sin Docker | Ni el enunciado lo pide ni hay una base de datos local que aislar; la app habla directo con S3 real |
| D10 | Pruebas E2E con un S3 simulado en memoria (`S3_MOCK=1`), independientes del bucket real | El agente nunca debe depender de credenciales reales para que sus pruebas pasen |

---

## 14. Reglas del agente

- No tocar AWS, nunca.
- No versionar `.env` con credenciales reales.
- `filename` siempre saneado antes de construir la `key`; nunca interpolar directamente input del usuario en una ruta S3.
- Validación de tipo/tamaño duplicada en frontend y backend.
- Si una prueba automatizada solo pasa relajando una validación de seguridad (tipo de archivo, tamaño, CORS), **detenerse y preguntar**, no ajustar el umbral para que pase.
- Protocolo de cierre de fase: pruebas en verde → commit (Conventional Commits) → push → actualizar secciones 3 y 15 → reportar → esperar confirmación.

---

## 15. Changelog

| Fecha | Cambio |
|---|---|
| 2026-10-14 | Planificación cerrada: alcance (obligatorio + SSE-KMS + CRR), stack (Node/Express backend, React/Vite/TS frontend), testing (Vitest/Supertest + Playwright + 6 pruebas manuales). Decisiones D1–D10. |
