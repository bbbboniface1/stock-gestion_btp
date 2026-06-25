import { Router, IRouter } from "express";
import { db, auditLogsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import { serializeDates } from "../lib/serialize";
import { z } from "zod";

const router: IRouter = Router();

router.get("/audit-logs", requireAuth, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const parsed = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(100),
  }).safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const rows = await db
    .select()
    .from(auditLogsTable)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(parsed.data.limit);

  res.json(serializeDates(rows));
});

export default router;
