import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/auth";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface AuthenticatedRequest extends Request {
  user?: { id: number; role: string; fullName: string; email: string };
}

type CachedUser = NonNullable<AuthenticatedRequest["user"]> & { expiresAt: number };

const AUTH_USER_CACHE_TTL_MS = 30_000;
const authUserCache = new Map<number, CachedUser>();

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Token invalide" });
    return;
  }
  const cached = authUserCache.get(payload.userId);
  if (cached && cached.expiresAt > Date.now()) {
    req.user = { id: cached.id, role: cached.role, fullName: cached.fullName, email: cached.email };
    next();
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
  if (!user) {
    authUserCache.delete(payload.userId);
    res.status(401).json({ error: "Utilisateur introuvable" });
    return;
  }
  req.user = { id: user.id, role: user.role, fullName: user.fullName, email: user.email };
  authUserCache.set(user.id, { ...req.user, expiresAt: Date.now() + AUTH_USER_CACHE_TTL_MS });
  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Accès refusé" });
      return;
    }
    next();
  };
}
