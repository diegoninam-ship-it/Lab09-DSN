import {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { config } from "./config.js";
import { listarObjetosMock, obtenerObjetoMock, eliminarObjetoMock } from "./mockS3.js";

function crearClienteReal() {
  return new S3Client({
    region: config.awsRegion,
    credentials: {
      accessKeyId: config.awsAccessKeyId,
      secretAccessKey: config.awsSecretAccessKey,
    },
  });
}

// Solo con S3_MOCK=1 (pruebas E2E): intercepta send() y responde contra el
// almacen en memoria de mockS3.js en vez de llamar a AWS de verdad.
function envolverConMockEnMemoria(cliente) {
  cliente.send = async (command) => {
    if (command instanceof ListObjectsV2Command) {
      return { Contents: listarObjetosMock(command.input.Prefix ?? "") };
    }

    if (command instanceof HeadObjectCommand) {
      const objeto = obtenerObjetoMock(command.input.Key);
      if (!objeto) {
        const error = new Error("No encontrado");
        error.name = "NotFound";
        throw error;
      }
      return {};
    }

    if (command instanceof DeleteObjectCommand) {
      eliminarObjetoMock(command.input.Key);
      return {};
    }

    throw new Error(`Comando no soportado por el S3 simulado: ${command.constructor.name}`);
  };

  return cliente;
}

export const s3Client = config.s3Mock
  ? envolverConMockEnMemoria(crearClienteReal())
  : crearClienteReal();
