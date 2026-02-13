import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const now = timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`);
const updatedNow = timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  createdAt: now,
  updatedAt: updatedNow,
});

export const agents = pgTable('agents', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  ownerId: uuid('owner_id').notNull(),
  createdAt: now,
  updatedAt: updatedNow,
});

export const policies = pgTable('policies', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  rules: jsonb('rules').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: now,
  updatedAt: updatedNow,
});

export const auditEntries = pgTable('audit_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorType: text('actor_type').notNull(),
  actorId: text('actor_id').notNull(),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
  createdAt: now,
});

export const approvalRequests = pgTable('approval_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  state: text('state').notNull(),
  requestedBy: uuid('requested_by').notNull(),
  approverId: uuid('approver_id'),
  reason: text('reason').notNull(),
  payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
  createdAt: now,
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  path: text('path').notNull(),
  contentType: text('content_type').notNull(),
  uploadedBy: uuid('uploaded_by').notNull(),
  metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
  createdAt: now,
});
