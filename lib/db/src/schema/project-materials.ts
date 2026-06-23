import { pgTable, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";
import { projectsTable } from "./projects";

export const projectMaterialsTable = pgTable("project_materials", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  quantityUsed: integer("quantity_used").notNull(),
});

export const insertProjectMaterialSchema = createInsertSchema(projectMaterialsTable).omit({ id: true });
export type InsertProjectMaterial = z.infer<typeof insertProjectMaterialSchema>;
export type ProjectMaterial = typeof projectMaterialsTable.$inferSelect;
