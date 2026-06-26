import { Router, IRouter, type RequestHandler } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyPassword, generateToken, revokeToken } from "../lib/auth";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";
import { LoginBody } from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

const loginLimiter: RequestHandler = (req, res, next) => {
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const current = loginAttempts.get(key);

  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    next();
    return;
  }

  if (current.count >= LOGIN_MAX_ATTEMPTS) {
    res.status(429).json({ error: "Trop de tentatives de connexion. Reessayez dans 15 minutes." });
    return;
  }

  current.count += 1;
  next();
};

router.post("/auth/login", loginLimiter, async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: "Email ou mot de passe incorrect" });
    return;
  }
  const token = generateToken(user.id, user.role);
  res.json(serializeDates({
    user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, createdAt: user.createdAt },
    token,
  }));
});

router.post("/auth/logout", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    await revokeToken(authHeader.slice(7));
  }
  res.json({ success: true });
});

router.get("/auth/me", requireAuth, (req: AuthenticatedRequest, res): void => {
  if (!req.user) { res.status(401).json({ error: "Non authentifie" }); return; }
  res.json(serializeDates(req.user));
});

export default router;
