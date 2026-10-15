// Almacen en memoria usado solo cuando S3_MOCK=1 (pruebas E2E). Sustituye al
// bucket real a nivel de proceso para que las pruebas nunca toquen AWS.
const almacen = new Map();

export function guardarObjetoMock(key, size) {
  almacen.set(key, { size, lastModified: new Date() });
}

export function obtenerObjetoMock(key) {
  return almacen.get(key);
}

export function eliminarObjetoMock(key) {
  almacen.delete(key);
}

export function listarObjetosMock(prefijo) {
  return [...almacen.entries()]
    .filter(([key]) => key.startsWith(prefijo))
    .map(([key, datos]) => ({ Key: key, Size: datos.size, LastModified: datos.lastModified }));
}
