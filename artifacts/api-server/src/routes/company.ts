import { Router, IRouter } from "express";
import { db, companySettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import { z } from "zod";
import { isValidLogoUrl } from "../lib/company-logo";

const router: IRouter = Router();

const logoUrlSchema = z.string().nullish().refine(
  (value) => value == null || value === "" || isValidLogoUrl(value),
  { message: "URL ou image base64 invalide (png, jpeg, webp, gif)" },
);

const UpdateCompanyBody = z.object({
  name: z.string().min(1).optional(),
  logoUrl: logoUrlSchema,
  address: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().email().nullish(),
  taxNumber: z.string().nullish(),
  currency: z.string().min(1).max(10).optional(),
  signatureText: z.string().nullish(),
});

router.get("/company-settings", requireAuth, async (_req, res): Promise<void> => {
  let [settings] = await db.select().from(companySettingsTable).limit(1);
  if (!settings) {
    [settings] = await db.insert(companySettingsTable)
      .values({ name: "Mon Entreprise", currency: "EUR" })
      .returning();
  }
  res.json(settings);
});

router.put("/company-settings", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = UpdateCompanyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  let [existing] = await db.select().from(companySettingsTable).limit(1);
  if (!existing) {
    const [created] = await db.insert(companySettingsTable)
      .values({ name: "Mon Entreprise", currency: "EUR", ...parsed.data })
      .returning();
    res.json(created);
    return;
  }
  const [updated] = await db.update(companySettingsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(companySettingsTable.id, existing.id))
    .returning();
  res.json(updated);
});

export default router;
