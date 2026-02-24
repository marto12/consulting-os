const express = require("express");
// @ts-ignore - generated at build time for Vercel
const { registerRoutes } = require("../server_dist/routes.js");

const app = express();

app.use(
  express.json({
    verify: (req: any, _res: any, buf: Buffer) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));

// Register all routes once; reuse across invocations
const initPromise = registerRoutes(app).then(() => {
  app.use((err: any, _req: any, res: any, next: any) => {
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

module.exports = async function handler(req: any, res: any) {
  await initPromise;
  app(req, res);
};
