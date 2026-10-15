import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import uploadUrlRouter from "./routes/uploadUrl.js";
import imagesRouter from "./routes/images.js";
import saludRouter from "./routes/salud.js";

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

  return app;
}

export const app = crearApp();
