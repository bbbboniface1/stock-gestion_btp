import { Router, IRouter } from "express";
import { db, stockMovementsTable, productsTable, usersTable, projectsTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import {
  ListStockMovementsQueryParams,
  ListStockMovementsResponse,
  CreateStockMovementBody,
  GetStockMovementParams,
  GetStockMovementResponse,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

async function getMovementsWithJoins(conditions: ReturnType<typeof and>[]) {
  return db
    .select({
      id: stockMovementsTable.id,
      productId: stockMovementsTable.productId,
      productName: productsTable.name,
      type: stockMovementsTable.type,
      quantity: stockMovementsTable.quantity,
      reason: stockMovementsTable.reason,
      projectId: stockMovementsTable.projectId,
      projectName: projectsTable.name,
      createdById: stockMovementsTable.createdById,
      createdByName: usersTable.fullName,
      createdAt: stockMovementsTable.createdAt,
    })
    .from(stockMovementsTable)
    .leftJoin(productsTable, eq(stockMovementsTable.productId, productsTable.id))
    .leftJoin(projectsTable, eq(stockMovementsTable.projectId, projectsTable.id))
    .leftJoin(usersTable, eq(stockMovementsTable.createdById, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${stockMovementsTable.createdAt} desc`);
}

router.get("/stock-movements", requireAuth, async (req, res): Promise<void> => {
  const params = ListStockMovementsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { product_id, project_id, type, from_date, to_date, limit = 50, offset = 0 } = params.data;
  const conditions: ReturnType<typeof eq>[] = [];
  if (product_id) conditions.push(eq(stockMovementsTable.productId, product_id));
  if (project_id) conditions.push(eq(stockMovementsTable.projectId, project_id));
  if (type) conditions.push(eq(stockMovementsTable.type, type as "IN" | "OUT"));
  if (from_date) conditions.push(gte(stockMovementsTable.createdAt, new Date(from_date)));
  if (to_date) conditions.push(lte(stockMovementsTable.createdAt, new Date(to_date)));

  const rows = await db
    .select({
      id: stockMovementsTable.id,
      productId: stockMovementsTable.productId,
      productName: productsTable.name,
      type: stockMovementsTable.type,
      quantity: stockMovementsTable.quantity,
      reason: stockMovementsTable.reason,
      projectId: stockMovementsTable.projectId,
      projectName: projectsTable.name,
      createdById: stockMovementsTable.createdById,
      createdByName: usersTable.fullName,
      createdAt: stockMovementsTable.createdAt,
    })
    .from(stockMovementsTable)
    .leftJoin(productsTable, eq(stockMovementsTable.productId, productsTable.id))
    .leftJoin(projectsTable, eq(stockMovementsTable.projectId, projectsTable.id))
    .leftJoin(usersTable, eq(stockMovementsTable.createdById, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${stockMovementsTable.createdAt} desc`)
    .limit(limit ?? 50)
    .offset(offset ?? 0);

  res.json(ListStockMovementsResponse.parse(serializeDates(rows)));
});

router.post("/stock-movements", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateStockMovementBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { productId, type, quantity, reason, projectId, createdById } = parsed.data;

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) { res.status(404).json({ error: "Produit introuvable" }); return; }

  if (type === "OUT") {
    if (product.quantityInStock < quantity) {
      res.status(400).json({ error: `Stock insuffisant. Disponible: ${product.quantityInStock}, demandé: ${quantity}` });
      return;
    }
    await db.update(productsTable)
      .set({ quantityInStock: product.quantityInStock - quantity })
      .where(eq(productsTable.id, productId));
  } else {
    await db.update(productsTable)
      .set({ quantityInStock: product.quantityInStock + quantity })
      .where(eq(productsTable.id, productId));
  }

  const [movement] = await db.insert(stockMovementsTable)
    .values({ productId, type, quantity, reason, projectId: projectId ?? null, createdById })
    .returning();

  const rows = await getMovementsWithJoins([eq(stockMovementsTable.id, movement.id)]);
  res.status(201).json(GetStockMovementResponse.parse(serializeDates(rows[0])));
});

router.get("/stock-movements/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetStockMovementParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const rows = await getMovementsWithJoins([eq(stockMovementsTable.id, params.data.id)]);
  if (!rows[0]) { res.status(404).json({ error: "Mouvement introuvable" }); return; }
  res.json(GetStockMovementResponse.parse(serializeDates(rows[0])));
});

export default router;
