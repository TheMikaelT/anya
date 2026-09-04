import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { apiRouter } from "./routes/api.js";
import { getUploadsDirectory } from "./services/appearance.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const corsOrigin = process.env.CORS_ORIGIN?.trim();

app.disable("x-powered-by");

if (corsOrigin) {
  app.use(cors({ origin: corsOrigin }));
}

app.use(express.json());
app.use("/api/uploads", express.static(getUploadsDirectory(), {
  fallthrough: false,
  index: false,
  maxAge: "1h"
}));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", apiRouter);

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  console.error(message);
  const status = message.includes("not found")
    ? 404
    : message.includes("timed out")
      ? 504
      : message.includes("required") || message.includes("valid") || message.includes("must")
        ? 400
        : 500;
  res.status(status).json({ error: message });
};

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Anya backend listening on port ${port}`);
});
