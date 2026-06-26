import { pgTable, text, serial, timestamp, integer, pgEnum, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";
import { projectsTable } from "./projects";
import { usersTable } from "./users";
import { invoicesTable } from "./invoices";

export const movementTypeEnum = pgEnum("movement_type", ["IN", "OUT"]);

export const stockMovementsTable = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  type: movementTypeEnum("type").notNull(),
  quantity: integer("quantity").notNull(),
  reason: text("reason").notNull(),
  projectId: integer("project_id").references(() => projectsTable.id),
  invoiceId: integer("invoice_id").references(() => invoicesTable.id),
  reversedByMovementId: integer("reversed_by_movement_id"),
  createdById: integer("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("stock_movements_created_at_idx").on(table.createdAt),
  index("stock_movements_product_id_idx").on(table.productId),
  index("stock_movements_project_id_idx").on(table.projectId),
  index("stock_movements_invoice_id_idx").on(table.invoiceId),
  index("stock_movements_created_by_idx").on(table.createdById),
  index("stock_movements_type_created_at_idx").on(table.type, table.createdAt),
  check("stock_movements_quantity_positive", sql`${table.quantity} > 0`),
]);

export const insertStockMovementSchema = createInsertSchema(stockMovementsTable).omit({ id: true, createdAt: true });
export type InsertStockMovement = z.infer<typeof insertStockMovementSchema>;
export type StockMovement = typeof stockMovementsTable.$inferSelect;
