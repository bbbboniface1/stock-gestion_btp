import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const corsOrigin = process.env.CORS_ORIGIN;
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !corsOrigin) {
  throw new Error("CORS_ORIGIN must be set in production");
}
if (!corsOrigin) {
  logger.warn("CORS_ORIGIN not set — API accepts all origins. Set CORS_ORIGIN in production.");
}
app.use(cors({
  origin: corsOrigin || "*",
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: Boolean(corsOrigin && corsOrigin !== "*"),
}));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de requêtes, réessayez dans 15 minutes." },
  skip: (req) => req.path === "/api/healthz",
});

const heavyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Limite de génération de PDF atteinte. Réessayez dans une minute." },
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", globalLimiter);
app.use("/api/reports/pdf", heavyLimiter);
app.use("/api/invoices/:id/pdf", heavyLimiter);

app.use("/api", router);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  if (!res.headersSent) {
    res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

export default app;
