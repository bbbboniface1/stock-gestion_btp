import { Router, IRouter } from "express";
import rateLimit from "express-rate-limit";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, generateToken } from "../lib/auth";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";
import { LoginBody } from "@workspace/api-zod";

const router: IRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de tentatives de connexion. Réessayez dans 15 minutes." },
  skipSuccessfulRequests: true,
});

router.post("/auth/login", loginLimiter, async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Email ou mot de passe incorrect" });
    return;
  }
  const token = generateToken(user.id, user.role);
  res.json({
    user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, createdAt: user.createdAt },
    token,
  });
});

router.post("/auth/logout", (_req, res): void => {
  res.json({ success: true });
});

router.get("/auth/me", requireAuth, (req: AuthenticatedRequest, res): void => {
  if (!req.user) { res.status(401).json({ error: "Non authentifié" }); return; }
  res.json(req.user);
});

export default router;
