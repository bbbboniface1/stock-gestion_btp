import { Router, IRouter } from "express";
import { db, productsTable } from "@workspace/db";
import { eq, ilike, sql, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import {
  ListProductsQueryParams,
  ListProductsResponse,
  CreateProductBody,
  GetProductParams,
  GetProductResponse,
  UpdateProductParams,
  UpdateProductBody,
  UpdateProductResponse,
  DeleteProductParams,
  ListProductCategoriesResponse,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

router.get("/products/categories", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      category: productsTable.category,
      totalQuantity: sql<number>`cast(sum(${productsTable.quantityInStock}) as int)`,
      productCount: sql<number>`cast(count(*) as int)`,
    })
    .from(productsTable)
    .groupBy(productsTable.category)
    .orderBy(productsTable.category);
  res.json(ListProductCategoriesResponse.parse(serializeDates(rows)));
});

router.get("/products", requireAuth, async (req, res): Promise<void> => {
  const params = ListProductsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { category, low_stock, search, location, limit = 50, offset = 0 } = params.data;

  const conditions = [];
  if (category) conditions.push(eq(productsTable.category, category));
  if (location) conditions.push(eq(productsTable.location, location as "warehouse" | "site" | "project"));
  if (search) conditions.push(ilike(productsTable.name, `%${search}%`));
  if (low_stock) conditions.push(sql`${productsTable.quantityInStock} < ${productsTable.minimumThreshold}`);

  const products = await db
    .select()
    .from(productsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(productsTable.name)
    .limit(limit ?? 50)
    .offset(offset ?? 0);

  res.json(ListProductsResponse.parse(serializeDates(products)));
});

router.post("/products", requireAuth, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [product] = await db.insert(productsTable).values(parsed.data).returning();
  res.status(201).json(GetProductResponse.parse(serializeDates(product)));
});

router.get("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!product) { res.status(404).json({ error: "Produit introuvable" }); return; }
  res.json(GetProductResponse.parse(serializeDates(product)));
});

router.patch("/products/:id", requireAuth, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [product] = await db.update(productsTable).set(parsed.data).where(eq(productsTable.id, params.data.id)).returning();
  if (!product) { res.status(404).json({ error: "Produit introuvable" }); return; }
  res.json(UpdateProductResponse.parse(serializeDates(product)));
});

router.delete("/products/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [product] = await db.delete(productsTable).where(eq(productsTable.id, params.data.id)).returning();
  if (!product) { res.status(404).json({ error: "Produit introuvable" }); return; }
  res.sendStatus(204);
});

export default router;
