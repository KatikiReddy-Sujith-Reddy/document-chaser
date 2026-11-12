import express, { type ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import path from "node:path";
import fs from "node:fs";
import { projectRoot } from "./config.js";
import type { ApiDependencies } from "./routes/api.js";
import { createApiRouter } from "./routes/api.js";
import { ApiError } from "./errors.js";

export type AppOptions = {
  staticDir?: string | false;
};

export function createApp(dependencies: ApiDependencies, options?: AppOptions) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));
  app.get("/health", (_request, response) => response.json({ status: "ok" }));
  app.use("/api", createApiRouter(dependencies));

  // Serve static frontend assets in production if available
  const staticDir = options?.staticDir !== false
    ? (typeof options?.staticDir === "string" ? options.staticDir : path.join(projectRoot, "frontend", "dist"))
    : undefined;

  if (staticDir && fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        return next();
      }
      if (req.path.startsWith("/api") || req.path === "/health") {
        return next();
      }
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    if (error instanceof ApiError) {
      response.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    if (error instanceof ZodError) {
      response.status(400).json({ error: { code: "INVALID_INPUT", message: "Request data is invalid." } });
      return;
    }
    console.error("[api] internal_error");
    response.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "An unexpected server error occurred." },
    });
  };
  app.use(errorHandler);
  return app;
}
