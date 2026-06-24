import { Router, IRouter } from "express";
import { db, stockMovementsTable, productsTable, usersTable, projectsTable } from "@workspace/db";
import { eq, and, gte, lt, lte, sql, type SQL } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import {
  ListStockMovementsQueryParams,
  ListStockMovementsResponse,
  CreateStockMovementBody,
  GetStockMovementParams,
  GetStockMovementResponse,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";
import { isDateOnly, parseDateBoundary } from "../lib/date-ranges";

const router: IRouter = Router();

async function getMovementsWithJoins(conditions: SQL[]) {
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

  const { product_id, project_id, type, from_date, to_date, created_by_id, limit = 50, offset = 0 } = params.data;
  const conditions: SQL[] = [];
  if (product_id) conditions.push(eq(stockMovementsTable.productId, product_id));
  if (project_id) conditions.push(eq(stockMovementsTable.projectId, project_id));
  if (type) conditions.push(eq(stockMovementsTable.type, type as "IN" | "OUT"));

  if (from_date) {
    const fromDate = parseDateBoundary(from_date, "start");
    if (!fromDate) { res.status(400).json({ error: "from_date invalide" }); return; }
    conditions.push(gte(stockMovementsTable.createdAt, fromDate));
  }

  if (to_date) {
    const toDate = parseDateBoundary(to_date, "end");
    if (!toDate) { res.status(400).json({ error: "to_date invalide" }); return; }
    conditions.push(isDateOnly(to_date) ? lt(stockMovementsTable.createdAt, toDate) : lte(stockMovementsTable.createdAt, toDate));
  }

  if (created_by_id) conditions.push(eq(stockMovementsTable.createdById, created_by_id));

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

router.post("/stock-movements", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateStockMovementBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { productId, type, quantity, reason, projectId } = parsed.data;

  const result = await db.transaction(async (tx) => {
    const [product] = await tx.select().from(productsTable).where(eq(productsTable.id, productId));
    if (!product) return { error: "Produit introuvable" as const, status: 404 };

    if (projectId) {
      const [project] = await tx.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      if (!project) return { error: "Projet introuvable" as const, status: 404 };
      if (project.status !== "active") return { error: "Le projet doit etre actif pour enregistrer un mouvement" as const, status: 400 };
    }

    if (type === "OUT") {
      const [updatedProduct] = await tx.update(productsTable)
        .set({ quantityInStock: sql`${productsTable.quantityInStock} - ${quantity}` })
        .where(and(eq(productsTable.id, productId), gte(productsTable.quantityInStock, quantity)))
        .returning();
      if (!updatedProduct) {
        return { error: `Stock insuffisant. Disponible: ${product.quantityInStock}, demande: ${quantity}` as const, status: 400 };
      }
    } else {
      await tx.update(productsTable)
        .set({ quantityInStock: sql`${productsTable.quantityInStock} + ${quantity}` })
        .where(eq(productsTable.id, productId));
    }

    const [movement] = await tx.insert(stockMovementsTable)
      .values({ productId, type, quantity, reason, projectId: projectId ?? null, createdById: req.user!.id })
      .returning();

    return { movement };
  });

  if ("error" in result && result.error) {
    res.status(result.status ?? 400).json({ error: result.error });
    return;
  }

  const rows = await getMovementsWithJoins([eq(stockMovementsTable.id, result.movement.id)]);
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
