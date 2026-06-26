import { pgTable, text, serial, timestamp, integer, pgEnum, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const unitEnum = pgEnum("unit_type", ["kg", "m", "litre", "piece"]);
export const locationEnum = pgEnum("location_type", ["warehouse", "site", "project"]);

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  unit: unitEnum("unit").notNull(),
  quantityInStock: integer("quantity_in_stock").notNull().default(0),
  minimumThreshold: integer("minimum_threshold").notNull().default(0),
  location: locationEnum("location").notNull().default("warehouse"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("products_name_idx").on(table.name),
  index("products_category_idx").on(table.category),
  index("products_location_idx").on(table.location),
  index("products_quantity_threshold_idx").on(table.quantityInStock, table.minimumThreshold),
  check("products_quantity_non_negative", sql`${table.quantityInStock} >= 0`),
  check("products_threshold_non_negative", sql`${table.minimumThreshold} >= 0`),
]);

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
