import { Router, IRouter } from "express";
import { db, productsTable, stockMovementsTable, projectsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import {
  GetDashboardSummaryResponse,
  GetRecentMovementsQueryParams,
  GetRecentMovementsResponse,
  GetLowStockProductsResponse,
  GetStockByCategoryResponse,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (_req, res): Promise<void> => {
  const [productsCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(productsTable);
  const [stockTotal] = await db.select({ total: sql<number>`cast(coalesce(sum(${productsTable.quantityInStock}), 0) as int)` }).from(productsTable);
  const [lowStockCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(productsTable)
    .where(sql`${productsTable.quantityInStock} < ${productsTable.minimumThreshold}`);
  const [activeProjects] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(projectsTable)
    .where(eq(projectsTable.status, "active"));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [inToday] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(stockMovementsTable)
    .where(sql`${stockMovementsTable.type} = 'IN' AND ${stockMovementsTable.createdAt} >= ${today}`);
  const [outToday] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(stockMovementsTable)
    .where(sql`${stockMovementsTable.type} = 'OUT' AND ${stockMovementsTable.createdAt} >= ${today}`);

  res.json(GetDashboardSummaryResponse.parse({
    totalProducts: productsCount?.count ?? 0,
    totalStockValue: stockTotal?.total ?? 0,
    lowStockCount: lowStockCount?.count ?? 0,
    activeProjects: activeProjects?.count ?? 0,
    todayMovementsIn: inToday?.count ?? 0,
    todayMovementsOut: outToday?.count ?? 0,
  }));
});

router.get("/dashboard/recent-movements", requireAuth, async (req, res): Promise<void> => {
  const params = GetRecentMovementsQueryParams.safeParse(req.query);
  const limit = params.success ? (params.data.limit ?? 10) : 10;

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
    .orderBy(sql`${stockMovementsTable.createdAt} desc`)
    .limit(limit);

  res.json(GetRecentMovementsResponse.parse(serializeDates(rows)));
});

router.get("/dashboard/low-stock", requireAuth, async (_req, res): Promise<void> => {
  const products = await db.select().from(productsTable)
    .where(sql`${productsTable.quantityInStock} < ${productsTable.minimumThreshold}`)
    .orderBy(productsTable.quantityInStock);
  res.json(GetLowStockProductsResponse.parse(serializeDates(products)));
});

router.get("/dashboard/stock-by-category", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      category: productsTable.category,
      totalQuantity: sql<number>`cast(sum(${productsTable.quantityInStock}) as int)`,
      productCount: sql<number>`cast(count(*) as int)`,
    })
    .from(productsTable)
    .groupBy(productsTable.category)
    .orderBy(productsTable.category);
  res.json(GetStockByCategoryResponse.parse(serializeDates(rows)));
});

export default router;
