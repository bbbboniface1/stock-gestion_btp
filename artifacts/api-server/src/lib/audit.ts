import { auditLogsTable, db } from "@workspace/db";
import { logger } from "./logger";

type AuditUser = {
  id?: number;
  email?: string;
};

type AuditInput = {
  action: string;
  entityType: string;
  entityId?: string | number | null;
  user?: AuditUser | null;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
};

export async function recordAuditLog(input: AuditInput): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId == null ? null : String(input.entityId),
      userId: input.user?.id ?? null,
      userEmail: input.user?.email ?? null,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (err) {
    logger.warn({ err, action: input.action, entityType: input.entityType }, "audit log skipped");
  }
}
