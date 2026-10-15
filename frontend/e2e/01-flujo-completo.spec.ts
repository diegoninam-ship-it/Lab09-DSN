import { test, expect } from "@playwright/test";

const API_URL = process.env.VITE_API_URL ?? "http://localhost:3010";

// Cubre las 6 pruebas obligatorias de la seccion 12 de CONTEXT.md, contra el
// backend real corriendo con S3_MOCK=1 (ver playwright.config.ts): nunca se
// toca el bucket real ni se usan credenciales de AWS.
test.describe("Flujo completo de la galeria (S3 simulado)", () => {
  test("1. sube una imagen JPG valida y aparece en la galeria", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("input-archivo").setInputFiles({
      name: "foto.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("contenido-de-prueba-jpg"),
    });
    await page.getByTestId("boton-subir").click();

    await expect(page.locator('img[alt^="originales/"]').first()).toBeVisible();
  });

  test("2. bloquea en el navegador un .pdf antes de llamar al backend", async ({ page }) => {
    await page.goto("/");

    const solicitudesUpload: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/upload-url")) solicitudesUpload.push(req.url());
    });

    await page.getByTestId("input-archivo").setInputFiles({
      name: "documento.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 contenido falso"),
    });

    await expect(page.locator("form").getByRole("alert")).toHaveText(/JPG, PNG o WEBP/);
    expect(solicitudesUpload).toHaveLength(0);
  });

  test("3. el backend rechaza un archivo de 10 MB aunque se salte la validacion del navegador", async ({
    page,
  }) => {
    await page.goto("/");

    const status = await page.evaluate(async (apiUrl) => {
      const respuesta = await fetch(`${apiUrl}/api/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "grande.jpg",
          contentType: "image/jpeg",
          sizeBytes: 10 * 1024 * 1024,
        }),
      });
      return respuesta.status;
    }, API_URL);

    expect(status).toBe(400);
  });

  test("4. la URL de lectura expira pasado el TTL configurado", async ({ page, request }) => {
    await page.goto("/");

    await page.getByTestId("input-archivo").setInputFiles({
      name: "expira.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("contenido-que-expira"),
    });
    await page.getByTestId("boton-subir").click();

    const imagen = page.locator('img[alt^="originales/"]').first();
    await expect(imagen).toBeVisible();
    const url = await imagen.getAttribute("src");
    expect(url).toBeTruthy();

    // READ_URL_TTL_SEGUNDOS=3 en este entorno de prueba (playwright.config.ts).
    await page.waitForTimeout(3500);

    const respuesta = await request.get(url as string);
    expect(respuesta.status()).toBe(403);
  });

  test("5. el codigo del frontend no expone credenciales de AWS", async ({ page }) => {
    await page.goto("/");

    const html = await page.content();
    expect(html).not.toMatch(/AKIA[0-9A-Z]{16}/);
    expect(html).not.toContain("AWS_SECRET_ACCESS_KEY");
    expect(html).not.toContain("e2e-secret-key");
    expect(html).not.toContain("e2e-access-key");
  });

  test("6. la subida va directa al endpoint de almacenamiento, no al backend", async ({ page }) => {
    await page.goto("/");

    const solicitudesPut: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "PUT") solicitudesPut.push(req.url());
    });

    await page.getByTestId("input-archivo").setInputFiles({
      name: "directo.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("contenido-directo"),
    });
    await page.getByTestId("boton-subir").click();
    await expect(page.locator('img[alt^="originales/"]').first()).toBeVisible();

    expect(solicitudesPut.length).toBeGreaterThan(0);
    expect(solicitudesPut[0]).toContain("/mock-s3/");
    expect(solicitudesPut[0]).not.toContain("/api/");
  });
});
