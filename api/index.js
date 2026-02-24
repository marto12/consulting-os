const express = require("express");
const { registerRoutes } = require("../server_dist/routes.js");

const app = express();

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));

const initPromise = registerRoutes(app).then(() => {
  app.use((err, _req, res, next) => {
    const status = err?.status || err?.statusCode || 500;
    const message = err?.message || "Internal Server Error";
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });
});

module.exports = async function handler(req, res) {
  await initPromise;
  app(req, res);
};
