import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const companySettingsTable = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default(""),
  logoUrl: text("logo_url"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  taxNumber: text("tax_number"),
  currency: text("currency").notNull().default("EUR"),
  signatureText: text("signature_text"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type CompanySettings = typeof companySettingsTable.$inferSelect;
