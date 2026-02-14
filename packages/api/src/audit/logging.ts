import { db } from '../db/client.js';
import { auditEntries } from '../db/schema.js';

export type AuditEventInput = {
  actorId: string;
  actorType: 'user' | 'agent';
  action: string;
  detail: string;
  costTokens?: number;
};

export async function logAuditEvent(input: AuditEventInput) {
  const [entry] = await db
    .insert(auditEntries)
    .values({
      actorId: input.actorId,
      actorType: input.actorType,
      action: input.action,
      detail: input.detail,
      costTokens: input.costTokens ?? 0,
    })
    .returning();

  return entry;
}
