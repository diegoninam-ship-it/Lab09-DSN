import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { mockClient } from "aws-sdk-client-mock";
import {
  ListObjectsV2Command,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { s3Client } from "../src/s3Client.js";

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://s3.mock.test/presigned-get"),
}));

const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
const { crearApp } = await import("../src/app.js");

const s3Mock = mockClient(s3Client);
const app = crearApp();

describe("GET /api/health", () => {
  it("responde ok sin contactar a S3", async () => {
    const respuesta = await request(app).get("/api/health");

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ estado: "ok" });
    expect(s3Mock.calls()).toHaveLength(0);
  });
});

describe("GET /api/images", () => {
  beforeEach(() => {
    s3Mock.reset();
    getSignedUrl.mockClear();
  });

  it("lista las imagenes con url de lectura firmada", async () => {
    s3Mock.on(ListObjectsV2Command).resolves({
      Contents: [
        {
          Key: "originales/1-abc-foto.jpg",
          Size: 2048,
          LastModified: new Date("2026-01-01T00:00:00Z"),
        },
      ],
    });

    const respuesta = await request(app).get("/api/images");

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual([
      {
        key: "originales/1-abc-foto.jpg",
        size: 2048,
        lastModified: "2026-01-01T00:00:00.000Z",
        url: "https://s3.mock.test/presigned-get",
      },
    ]);

    const opciones = getSignedUrl.mock.calls[0][2];
    expect(opciones.expiresIn).toBe(900);
  });

  it("devuelve una lista vacia cuando el bucket no tiene imagenes", async () => {
    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });

    const respuesta = await request(app).get("/api/images");

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual([]);
  });
});

describe("DELETE /api/images/:key", () => {
  beforeEach(() => {
    s3Mock.reset();
  });

  it("elimina una imagen existente", async () => {
    s3Mock.on(HeadObjectCommand).resolves({});
    s3Mock.on(DeleteObjectCommand).resolves({});

    const respuesta = await request(app).delete(
      "/api/images/originales/1-abc-foto.jpg"
    );

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ deleted: true });

    const llamadaDelete = s3Mock.commandCalls(DeleteObjectCommand)[0];
    expect(llamadaDelete.args[0].input.Key).toBe("originales/1-abc-foto.jpg");
  });

  it("responde 404 cuando la imagen no existe", async () => {
    const error = new Error("No encontrado");
    error.name = "NotFound";
    s3Mock.on(HeadObjectCommand).rejects(error);

    const respuesta = await request(app).delete(
      "/api/images/originales/no-existe.jpg"
    );

    expect(respuesta.status).toBe(404);
  });

  it("rechaza borrar una key fuera del prefijo originales/", async () => {
    const respuesta = await request(app).delete("/api/images/temporal/archivo.jpg");

    expect(respuesta.status).toBe(400);
    expect(s3Mock.calls()).toHaveLength(0);
  });
});
