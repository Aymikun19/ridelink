import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { notifyRouter } from "./routes/notify.js";
import { HttpError } from "./lib/errors.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: process.env.APP_URL ? [process.env.APP_URL] : true }));
  app.use(express.json({ limit: "32kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });
  app.use("/api/auth", authRouter);
  app.use("/api/notify", notifyRouter);

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    console.error("[api] unhandled", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  });

  return app;
}
