import express from "express";
import uploadUrlRouter from "./routes/uploadUrl.js";

export function crearApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/upload-url", uploadUrlRouter);
  return app;
}

export const app = crearApp();
