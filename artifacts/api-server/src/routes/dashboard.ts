import { Router, IRouter } from "express";
import { db, pool, productsTable, stockMovementsTable, projectsTable, usersTable } from "@workspace/db";
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
import { getReportRange } from "../lib/date-ranges";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (_req, res): Promise<void> => {
  const { start: todayStart, endExclusive: tomorrowStart } = getReportRange("day", new Date());
  const { rows } = await pool.query<{
    totalProducts: number;
    totalStockValue: number;
    lowStockCount: number;
    activeProjects: number;
    todayMovementsIn: number;
    todayMovementsOut: number;
  }>(
    `
      select
        (select count(*)::int from products) as "totalProducts",
        (select coalesce(sum(quantity_in_stock), 0)::int from products) as "totalStockValue",
        (select count(*)::int from products where quantity_in_stock < minimum_threshold) as "lowStockCount",
        (select count(*)::int from projects where status = 'active') as "activeProjects",
        (select coalesce(sum(quantity), 0)::int from stock_movements where type = 'IN' and created_at >= $1 and created_at < $2) as "todayMovementsIn",
        (select coalesce(sum(quantity), 0)::int from stock_movements where type = 'OUT' and created_at >= $1 and created_at < $2) as "todayMovementsOut"
    `,
    [todayStart, tomorrowStart],
  );
  const summary = rows[0];

  res.json(GetDashboardSummaryResponse.parse({
    totalProducts: summary?.totalProducts ?? 0,
    totalStockValue: summary?.totalStockValue ?? 0,
    lowStockCount: summary?.lowStockCount ?? 0,
    activeProjects: summary?.activeProjects ?? 0,
    todayMovementsIn: summary?.todayMovementsIn ?? 0,
    todayMovementsOut: summary?.todayMovementsOut ?? 0,
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
    .orderBy(productsTable.quantityInStock)
    .limit(100);
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

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get("/dashboard/movements-by-day", requireAuth, async (req, res): Promise<void> => {
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  if (!from || !to) { res.status(400).json({ error: "from et to requis (YYYY-MM-DD)" }); return; }
  if (!DATE_ONLY_RE.test(from) || !DATE_ONLY_RE.test(to)) {
    res.status(400).json({ error: "Format de date invalide. Attendu: YYYY-MM-DD" });
    return;
  }
  if (from > to) {
    res.status(400).json({ error: "La date de début doit être antérieure à la date de fin" });
    return;
  }

  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${stockMovementsTable.createdAt} AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`,
      type: stockMovementsTable.type,
      total: sql<number>`cast(sum(${stockMovementsTable.quantity}) as int)`,
    })
    .from(stockMovementsTable)
    .where(sql`${stockMovementsTable.createdAt} >= ${from}::date AND ${stockMovementsTable.createdAt} < (${to}::date + interval '1 day')`)
    .groupBy(sql`1`, stockMovementsTable.type)
    .orderBy(sql`1`);

  const byDay: Record<string, { date: string; IN: number; OUT: number }> = {};
  for (const row of rows) {
    if (!byDay[row.day]) byDay[row.day] = { date: row.day, IN: 0, OUT: 0 };
    byDay[row.day][row.type as "IN" | "OUT"] += row.total;
  }

  res.json(Object.values(byDay));
});

export default router;
