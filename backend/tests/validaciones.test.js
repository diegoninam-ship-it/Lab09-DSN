import { describe, it, expect, vi } from "vitest";
import { sanearNombreArchivo, validarSolicitudSubida } from "../src/middleware/validarArchivo.js";

function crearRespuestaFalsa() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("sanearNombreArchivo", () => {
  it("reemplaza espacios y simbolos no permitidos por guion bajo", () => {
    expect(sanearNombreArchivo("foto final (1).JPG")).toBe("foto_final__1_.JPG");
  });

  it("elimina barras para evitar path traversal", () => {
    expect(sanearNombreArchivo("../../etc/passwd.png")).not.toContain("/");
  });

  it("deja intactos letras, numeros, puntos, guiones y guion bajo", () => {
    expect(sanearNombreArchivo("imagen-01_v2.png")).toBe("imagen-01_v2.png");
  });
});

describe("validarSolicitudSubida", () => {
  it("llama a next() y adjunta el archivo saneado cuando los datos son validos", () => {
    const req = { body: { filename: "foto.png", contentType: "image/png", sizeBytes: 1000 } };
    const res = crearRespuestaFalsa();
    const next = vi.fn();

    validarSolicitudSubida(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.archivoSaneado).toEqual({
      filename: "foto.png",
      contentType: "image/png",
      sizeBytes: 1000,
    });
  });

  it("rechaza un contentType no permitido", () => {
    const req = { body: { filename: "doc.pdf", contentType: "application/pdf", sizeBytes: 1000 } };
    const res = crearRespuestaFalsa();
    const next = vi.fn();

    validarSolicitudSubida(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rechaza sizeBytes mayor al maximo permitido", () => {
    const req = {
      body: { filename: "foto.jpg", contentType: "image/jpeg", sizeBytes: 6 * 1024 * 1024 },
    };
    const res = crearRespuestaFalsa();
    const next = vi.fn();

    validarSolicitudSubida(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rechaza una solicitud sin filename", () => {
    const req = { body: { contentType: "image/jpeg", sizeBytes: 1000 } };
    const res = crearRespuestaFalsa();
    const next = vi.fn();

    validarSolicitudSubida(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
