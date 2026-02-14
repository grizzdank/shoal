import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const now = timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`);
const updatedNow = timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  authProvider: text('auth_provider').notNull(),
  createdAt: now,
  updatedAt: updatedNow,
});

export const agents = pgTable('agents', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  model: text('model').notNull(),
  channels: jsonb('channels').notNull().default(sql`'[]'::jsonb`),
  toolPermissions: jsonb('tool_permissions').notNull().default(sql`'{}'::jsonb`),
  status: text('status').notNull(),
  createdAt: now,
  updatedAt: updatedNow,
});

export const policies = pgTable('policies', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: text('type').notNull(),
  rulesJson: jsonb('rules_json').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: now,
  updatedAt: updatedNow,
});

export const auditEntries = pgTable('audit_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorId: text('actor_id').notNull(),
  actorType: text('actor_type').notNull(),
  action: text('action').notNull(),
  detail: text('detail').notNull(),
  costTokens: integer('cost_tokens').notNull().default(0),
  createdAt: now,
});

export const approvalRequests = pgTable('approval_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  agentId: uuid('agent_id').notNull(),
  actionType: text('action_type').notNull(),
  params: jsonb('params').notNull().default(sql`'{}'::jsonb`),
  state: text('state').notNull(),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().default(sql`now()`),
  decidedBy: uuid('decided_by'),
});

export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  uploadedBy: uuid('uploaded_by').notNull(),
  storagePath: text('storage_path').notNull(),
  createdAt: now,
});
