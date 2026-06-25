import { pgTable, integer } from "drizzle-orm/pg-core";

export const invoiceSequencesTable = pgTable("invoice_sequences", {
  year: integer("year").primaryKey(),
  lastNumber: integer("last_number").notNull().default(0),
});

export type InvoiceSequence = typeof invoiceSequencesTable.$inferSelect;
