import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const revokedTokensTable = pgTable("revoked_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [
  index("revoked_tokens_expires_at_idx").on(table.expiresAt),
]);

export type RevokedToken = typeof revokedTokensTable.$inferSelect;
