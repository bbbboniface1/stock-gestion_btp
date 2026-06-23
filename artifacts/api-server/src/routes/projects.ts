import { Router, IRouter } from "express";
import { db, projectsTable, projectMaterialsTable, productsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import {
  ListProjectsQueryParams,
  ListProjectsResponse,
  CreateProjectBody,
  GetProjectParams,
  GetProjectResponse,
  UpdateProjectParams,
  UpdateProjectBody,
  UpdateProjectResponse,
  GetProjectMaterialsParams,
  GetProjectMaterialsResponse,
  AddProjectMaterialParams,
  AddProjectMaterialBody,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

router.get("/projects", requireAuth, async (req, res): Promise<void> => {
  const params = ListProjectsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const { status } = params.data;
  const projects = status
    ? await db.select().from(projectsTable).where(eq(projectsTable.status, status as "active" | "completed" | "paused")).orderBy(projectsTable.createdAt)
    : await db.select().from(projectsTable).orderBy(projectsTable.createdAt);
  res.json(ListProjectsResponse.parse(serializeDates(projects)));
});

router.post("/projects", requireAuth, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [project] = await db.insert(projectsTable).values(parsed.data).returning();
  res.status(201).json(GetProjectResponse.parse(serializeDates(project)));
});

router.get("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, params.data.id));
  if (!project) { res.status(404).json({ error: "Projet introuvable" }); return; }
  res.json(GetProjectResponse.parse(serializeDates(project)));
});

router.patch("/projects/:id", requireAuth, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [project] = await db.update(projectsTable).set(parsed.data).where(eq(projectsTable.id, params.data.id)).returning();
  if (!project) { res.status(404).json({ error: "Projet introuvable" }); return; }
  res.json(UpdateProjectResponse.parse(serializeDates(project)));
});

router.get("/projects/:id/materials", requireAuth, async (req, res): Promise<void> => {
  const params = GetProjectMaterialsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const rows = await db
    .select({
      id: projectMaterialsTable.id,
      projectId: projectMaterialsTable.projectId,
      productId: projectMaterialsTable.productId,
      productName: productsTable.name,
      quantityUsed: projectMaterialsTable.quantityUsed,
      unit: productsTable.unit,
    })
    .from(projectMaterialsTable)
    .leftJoin(productsTable, eq(projectMaterialsTable.productId, productsTable.id))
    .where(eq(projectMaterialsTable.projectId, params.data.id));
  res.json(GetProjectMaterialsResponse.parse(serializeDates(rows)));
});

router.post("/projects/:id/materials", requireAuth, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const params = AddProjectMaterialParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = AddProjectMaterialBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [material] = await db.insert(projectMaterialsTable)
    .values({ projectId: params.data.id, productId: parsed.data.productId, quantityUsed: parsed.data.quantityUsed })
    .returning();
  const [withProduct] = await db
    .select({
      id: projectMaterialsTable.id,
      projectId: projectMaterialsTable.projectId,
      productId: projectMaterialsTable.productId,
      productName: productsTable.name,
      quantityUsed: projectMaterialsTable.quantityUsed,
      unit: productsTable.unit,
    })
    .from(projectMaterialsTable)
    .leftJoin(productsTable, eq(projectMaterialsTable.productId, productsTable.id))
    .where(eq(projectMaterialsTable.id, material.id));
  res.status(201).json(withProduct);
});

export default router;
