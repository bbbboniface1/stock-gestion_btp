import { Router, IRouter } from "express";
import { db, usersTable, stockMovementsTable } from "@workspace/db";
import { eq, count, and, ne } from "drizzle-orm";
import { hashPassword } from "../lib/auth";
import { invalidateAuthUserCache, requireAuth, requireRole, AuthenticatedRequest } from "../middlewares/auth";
import { recordAuditLog } from "../lib/audit";
import {
  ListUsersResponse,
  GetUserResponse,
  GetUserParams,
  CreateUserBody,
  UpdateUserParams,
  UpdateUserBody,
  UpdateUserResponse,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

async function countAdmins(excludeUserId?: number): Promise<number> {
  const conditions = [eq(usersTable.role, "admin")];
  if (excludeUserId !== undefined) {
    conditions.push(ne(usersTable.id, excludeUserId));
  }
  const [result] = await db
    .select({ total: count() })
    .from(usersTable)
    .where(and(...conditions));
  return result?.total ?? 0;
}

router.get("/users", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  const users = await db.select({
    id: usersTable.id,
    fullName: usersTable.fullName,
    email: usersTable.email,
    role: usersTable.role,
    createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(usersTable.createdAt);
  res.json(ListUsersResponse.parse(serializeDates(users)));
});

router.post("/users", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { fullName, email, role, password } = parsed.data;
  const passwordHash = await hashPassword(password);
  let user;
  try {
    [user] = await db.insert(usersTable).values({ fullName, email, role, passwordHash }).returning();
  } catch (err: any) {
    const isUniqueViolation = err?.code === "23505" || err?.message?.includes("unique");
    if (isUniqueViolation) {
      res.status(409).json({ error: "Un utilisateur avec cet email existe déjà" });
      return;
    }
    throw err;
  }
  void recordAuditLog({ action: "create", entityType: "user", entityId: user.id, user: req.user, newValue: { id: user.id, email: user.email, role: user.role } });
  res.status(201).json(GetUserResponse.parse(serializeDates({
    id: user.id, fullName: user.fullName, email: user.email, role: user.role, createdAt: user.createdAt,
  })));
});

router.get("/users/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [user] = await db.select({
    id: usersTable.id, fullName: usersTable.fullName, email: usersTable.email, role: usersTable.role, createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!user) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }
  res.json(GetUserResponse.parse(serializeDates(user)));
});

router.patch("/users/:id", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [before] = await db.select({ id: usersTable.id, role: usersTable.role, fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!before) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }

  if (parsed.data.role && parsed.data.role !== "admin" && before.role === "admin") {
    if (req.user?.id === params.data.id) {
      res.status(400).json({ error: "Vous ne pouvez pas rétrograder votre propre compte administrateur" });
      return;
    }
    const remainingAdmins = await countAdmins(params.data.id);
    if (remainingAdmins === 0) {
      res.status(400).json({ error: "Impossible de retirer le dernier administrateur" });
      return;
    }
  }

  const [user] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.id, params.data.id)).returning();
  invalidateAuthUserCache(user.id);
  void recordAuditLog({ action: "update", entityType: "user", entityId: user.id, user: req.user, oldValue: { role: before.role, fullName: before.fullName }, newValue: { role: user.role, fullName: user.fullName } });
  res.json(UpdateUserResponse.parse(serializeDates({
    id: user.id, fullName: user.fullName, email: user.email, role: user.role, createdAt: user.createdAt,
  })));
});

router.delete("/users/:id", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  if (req.user?.id === params.data.id) {
    res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte" });
    return;
  }

  const [movementCount] = await db
    .select({ total: count() })
    .from(stockMovementsTable)
    .where(eq(stockMovementsTable.createdById, params.data.id));

  if (movementCount.total > 0) {
    res.status(409).json({
      error: `Impossible de supprimer cet utilisateur : il a créé ${movementCount.total} mouvement(s) de stock. Modifiez son rôle plutôt que de le supprimer.`,
    });
    return;
  }

  const [target] = await db
    .select({ id: usersTable.id, role: usersTable.role, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, params.data.id));
  if (!target) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }

  if (target.role === "admin") {
    const remainingAdmins = await countAdmins(params.data.id);
    if (remainingAdmins === 0) {
      res.status(400).json({ error: "Impossible de supprimer le dernier administrateur" });
      return;
    }
  }

  await db.delete(usersTable).where(eq(usersTable.id, params.data.id));
  invalidateAuthUserCache(target.id);
  void recordAuditLog({ action: "delete", entityType: "user", entityId: target.id, user: req.user, oldValue: { email: target.email, role: target.role } });
  res.sendStatus(204);
});

export default router;
