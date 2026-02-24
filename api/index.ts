import express from "express";
import type { Request, Response, NextFunction } from "express";
// @ts-ignore - generated at build time for Vercel
import { registerRoutes } from "../server_dist/routes.js";

const app = express();

app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));

// Register all routes once; reuse across invocations
const initPromise = registerRoutes(app).then(() => {
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });
});

export default async function handler(req: Request, res: Response) {
  await initPromise;
  app(req, res);
}
