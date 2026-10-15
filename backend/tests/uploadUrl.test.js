import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { mockClient } from "aws-sdk-client-mock";
import { s3Client } from "../src/s3Client.js";

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://s3.mock.test/presigned-put"),
}));

const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
const { crearApp } = await import("../src/app.js");

const s3Mock = mockClient(s3Client);
const app = crearApp();

describe("POST /api/upload-url", () => {
  beforeEach(() => {
    s3Mock.reset();
    getSignedUrl.mockClear();
  });

  it("genera una URL firmada para un archivo valido", async () => {
    const respuesta = await request(app)
      .post("/api/upload-url")
      .send({ filename: "foto vacaciones.jpg", contentType: "image/jpeg", sizeBytes: 1024 });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.uploadUrl).toBe("https://s3.mock.test/presigned-put");
    expect(respuesta.body.key).toMatch(/^originales\/\d+-[\w-]+-foto_vacaciones\.jpg$/);

    const comando = getSignedUrl.mock.calls[0][1];
    expect(comando.input.Bucket).toBe("test-bucket");
    expect(comando.input.ContentType).toBe("image/jpeg");
    expect(comando.input.ServerSideEncryption).toBe("aws:kms");
    expect(comando.input.SSEKMSKeyId).toBe("alias/test-key");

    const opciones = getSignedUrl.mock.calls[0][2];
    expect(opciones.expiresIn).toBe(300);

    expect(s3Mock.calls()).toHaveLength(0);
  });

  it("sanea el filename y nunca permite que la key contenga una barra extra (path traversal)", async () => {
    const respuesta = await request(app)
      .post("/api/upload-url")
      .send({ filename: "../../etc/passwd.png", contentType: "image/png", sizeBytes: 100 });

    expect(respuesta.status).toBe(200);
    const partes = respuesta.body.key.split("/");
    expect(partes).toHaveLength(2);
    expect(partes[0]).toBe("originales");
  });

  it("rechaza un contentType no permitido", async () => {
    const respuesta = await request(app)
      .post("/api/upload-url")
      .send({ filename: "malware.exe", contentType: "application/x-msdownload", sizeBytes: 1024 });

    expect(respuesta.status).toBe(400);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it("rechaza un archivo que supera el tamano maximo", async () => {
    const respuesta = await request(app)
      .post("/api/upload-url")
      .send({ filename: "grande.png", contentType: "image/png", sizeBytes: 6 * 1024 * 1024 });

    expect(respuesta.status).toBe(400);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
});
