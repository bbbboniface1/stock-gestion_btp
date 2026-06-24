import { Router, IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "../lib/auth";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middlewares/auth";
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

router.post("/users", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { fullName, email, role, password } = parsed.data;
  const passwordHash = hashPassword(password);
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

router.patch("/users/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [user] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.id, params.data.id)).returning();
  if (!user) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }
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

  const [user] = await db.delete(usersTable).where(eq(usersTable.id, params.data.id)).returning();
  if (!user) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }
  res.sendStatus(204);
});

export default router;
