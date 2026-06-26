import { pgTable, serial, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";
import { projectsTable } from "./projects";

export const projectMaterialsTable = pgTable("project_materials", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  quantityUsed: integer("quantity_used").notNull(),
}, (table) => [
  index("project_materials_project_id_idx").on(table.projectId),
  index("project_materials_product_id_idx").on(table.productId),
  uniqueIndex("project_materials_project_product_unique").on(table.projectId, table.productId),
]);

export const insertProjectMaterialSchema = createInsertSchema(projectMaterialsTable).omit({ id: true });
export type InsertProjectMaterial = z.infer<typeof insertProjectMaterialSchema>;
export type ProjectMaterial = typeof projectMaterialsTable.$inferSelect;
