import { Router, IRouter } from "express";
import { db, productsTable, stockMovementsTable, projectMaterialsTable } from "@workspace/db";
import { eq, ilike, sql, and } from "drizzle-orm";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middlewares/auth";
import { recordAuditLog } from "../lib/audit";
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

router.post("/products", requireAuth, requireRole("admin", "manager"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  if (parsed.data.quantityInStock < 0 || parsed.data.minimumThreshold < 0) {
    res.status(400).json({ error: "Les quantites et seuils ne peuvent pas etre negatifs" });
    return;
  }

  const product = await db.transaction(async (tx) => {
    const [createdProduct] = await tx.insert(productsTable).values(parsed.data).returning();

    if (parsed.data.quantityInStock > 0) {
      await tx.insert(stockMovementsTable).values({
        productId: createdProduct.id,
        type: "IN",
        quantity: parsed.data.quantityInStock,
        reason: "Stock initial",
        projectId: null,
        createdById: req.user!.id,
      });
    }

    return createdProduct;
  });

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

  if (parsed.data.minimumThreshold !== undefined && parsed.data.minimumThreshold < 0) {
    res.status(400).json({ error: "Le seuil minimum ne peut pas etre negatif" });
    return;
  }

  const [product] = await db.update(productsTable).set(parsed.data).where(eq(productsTable.id, params.data.id)).returning();
  if (!product) { res.status(404).json({ error: "Produit introuvable" }); return; }
  res.json(UpdateProductResponse.parse(serializeDates(product)));
});

router.delete("/products/:id", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [movementLinks] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(stockMovementsTable).where(eq(stockMovementsTable.productId, params.data.id));
  const [materialLinks] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(projectMaterialsTable).where(eq(projectMaterialsTable.productId, params.data.id));
  if ((movementLinks?.count ?? 0) > 0 || (materialLinks?.count ?? 0) > 0) {
    res.status(409).json({ error: "Produit lie a un historique de stock ou a un projet. Suppression refusee pour conserver la tracabilite." });
    return;
  }

  const [product] = await db.delete(productsTable).where(eq(productsTable.id, params.data.id)).returning();
  if (!product) { res.status(404).json({ error: "Produit introuvable" }); return; }
  void recordAuditLog({
    action: "delete",
    entityType: "product",
    entityId: product.id,
    user: req.user,
    oldValue: serializeDates(product),
  });
  res.sendStatus(204);
});

export default router;
