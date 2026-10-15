import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import uploadUrlRouter from "./routes/uploadUrl.js";
import imagesRouter from "./routes/images.js";
import saludRouter from "./routes/salud.js";
import mockS3Router from "./routes/mockS3.js";

export function crearApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  const limitadorSubida = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use("/api/upload-url", limitadorSubida, uploadUrlRouter);
  app.use("/api/images", imagesRouter);
  app.use("/api/health", saludRouter);

  // Solo existe en modo E2E (S3_MOCK=1): sustituye al bucket real para las
  // subidas y lecturas directas que el frontend hace sin pasar por el backend.
  if (config.s3Mock) {
    app.use("/mock-s3", mockS3Router);
  }

  return app;
}

export const app = crearApp();
