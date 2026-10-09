import { initTRPC } from '@trpc/server';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { db } from '../db/client.js';
import {
  agents,
  approvalRequests,
  auditEntries,
  documents,
  policies,
  users,
} from '../db/schema.js';
import {
  evaluateApprovalPolicies,
  evaluateContentPolicies,
  evaluateToolPolicies,
} from '../policies/engine.js';
import { logAuditEvent } from '../audit/logging.js';
import { canTransitionApprovalState } from '../approvals/state.js';
import { getConstraints } from '../governance/service.js';

type TrpcContext = {
  authHeader: string | null;
  userId: string | null;
  userRole: 'admin' | 'member' | 'viewer' | null;
};

const t = initTRPC.context<TrpcContext>().create();
const procedure = t.procedure;
const authedProcedure = procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }
  return next();
});
const roleProcedure = (allowedRoles: Array<'admin' | 'member' | 'viewer'>) =>
  authedProcedure.use(({ ctx, next }) => {
    if (!ctx.userRole || !allowedRoles.includes(ctx.userRole)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Insufficient role permissions',
      });
    }
    return next();
  });
const adminProcedure = roleProcedure(['admin']);
const memberProcedure = roleProcedure(['admin', 'member']);

const idInput = z.object({ id: z.string().uuid() });
const paginationInput = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  query: z.string().trim().min(1).optional(),
});

const rulesJsonSchema = z.record(z.string(), z.unknown());
const paramsSchema = z.record(z.string(), z.unknown());
const nonEmptyObject = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object(shape)
    .refine(
      (value) => Object.keys(value).length > 0,
      'At least one field must be provided',
    );

const countRows = async (
  table:
    | typeof users
    | typeof agents
    | typeof policies
    | typeof auditEntries
    | typeof approvalRequests
    | typeof documents,
  whereClause?: ReturnType<typeof eq>,
) => {
  const query = db.select({ count: sql<number>`count(*)::int` }).from(table);
  const [result] = whereClause ? await query.where(whereClause) : await query;
  return result?.count ?? 0;
};
const ctxActor = (ctx: TrpcContext) => ({
  actorId: ctx.userId ?? 'system',
  actorType: 'user' as const,
});

const usersRouter = t.router({
  list: authedProcedure
    .input(paginationInput.optional())
    .query(async ({ input }) => {
      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;
      const whereClause = input?.query
        ? or(
            ilike(users.email, `%${input.query}%`),
            ilike(users.name, `%${input.query}%`),
            ilike(users.role, `%${input.query}%`),
          )
        : undefined;
      const itemsQuery = db
        .select()
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);
      const items = whereClause
        ? await itemsQuery.where(whereClause)
        : await itemsQuery;
      const total = await countRows(users, whereClause);
      return { items, total, limit, offset };
    }),
  get: authedProcedure.input(idInput).query(async ({ input }) => {
    const [item] = await db
      .select()
      .from(users)
      .where(eq(users.id, input.id))
      .limit(1);
    return item ?? null;
  }),
  create: adminProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().min(1),
        role: z.enum(['admin', 'member', 'viewer']),
        authProvider: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const [created] = await db.insert(users).values(input).returning();
      return created;
    }),
  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: nonEmptyObject({
          email: z.string().email().optional(),
          name: z.string().min(1).optional(),
          role: z.enum(['admin', 'member', 'viewer']).optional(),
          authProvider: z.string().min(1).optional(),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      const [updated] = await db
        .update(users)
        .set({ ...input.data, updatedAt: new Date() })
        .where(eq(users.id, input.id))
        .returning();
      return updated ?? null;
    }),
  delete: adminProcedure.input(idInput).mutation(async ({ input }) => {
    const [deleted] = await db
      .delete(users)
      .where(eq(users.id, input.id))
      .returning({ id: users.id });
    return { id: deleted?.id ?? input.id, deleted: Boolean(deleted) };
  }),
});

const agentsRouter = t.router({
  list: authedProcedure
    .input(paginationInput.optional())
    .query(async ({ input }) => {
      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;
      const whereClause = input?.query
        ? or(
            ilike(agents.name, `%${input.query}%`),
            ilike(agents.model, `%${input.query}%`),
            ilike(agents.status, `%${input.query}%`),
          )
        : undefined;
      const itemsQuery = db
        .select()
        .from(agents)
        .orderBy(desc(agents.createdAt))
        .limit(limit)
        .offset(offset);
      const items = whereClause
        ? await itemsQuery.where(whereClause)
        : await itemsQuery;
      const total = await countRows(agents, whereClause);
      return { items, total, limit, offset };
    }),
  get: authedProcedure.input(idInput).query(async ({ input }) => {
    const [item] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, input.id))
      .limit(1);
    return item ?? null;
  }),
  create: memberProcedure
    .input(
      z.object({
        name: z.string().min(1),
        systemPrompt: z.string().min(1),
        model: z.string().min(1),
        channels: z.array(z.string()).default([]),
        toolPermissions: z.record(z.string(), z.unknown()).default({}),
        status: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const [created] = await db.insert(agents).values(input).returning();
      return created;
    }),
  update: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: nonEmptyObject({
          name: z.string().min(1).optional(),
          systemPrompt: z.string().min(1).optional(),
          model: z.string().min(1).optional(),
          channels: z.array(z.string()).optional(),
          toolPermissions: z.record(z.string(), z.unknown()).optional(),
          status: z.string().min(1).optional(),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      const [updated] = await db
        .update(agents)
        .set({ ...input.data, updatedAt: new Date() })
        .where(eq(agents.id, input.id))
        .returning();
      return updated ?? null;
    }),
  delete: memberProcedure.input(idInput).mutation(async ({ input }) => {
    const [deleted] = await db
      .delete(agents)
      .where(eq(agents.id, input.id))
      .returning({ id: agents.id });
    return { id: deleted?.id ?? input.id, deleted: Boolean(deleted) };
  }),
});

const policiesRouter = t.router({
  list: authedProcedure
    .input(paginationInput.optional())
    .query(async ({ input }) => {
      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;
      const whereClause = input?.query
        ? ilike(policies.type, `%${input.query}%`)
        : undefined;
      const itemsQuery = db
        .select()
        .from(policies)
        .orderBy(desc(policies.createdAt))
        .limit(limit)
        .offset(offset);
      const items = whereClause
        ? await itemsQuery.where(whereClause)
        : await itemsQuery;
      const total = await countRows(policies, whereClause);
      return { items, total, limit, offset };
    }),
  get: authedProcedure.input(idInput).query(async ({ input }) => {
    const [item] = await db
      .select()
      .from(policies)
      .where(eq(policies.id, input.id))
      .limit(1);
    return item ?? null;
  }),
  create: memberProcedure
    .input(
      z.object({
        type: z.enum([
          'content_filter',
          'tool_restriction',
          'approval_required',
        ]),
        rulesJson: rulesJsonSchema,
        enabled: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const [created] = await db.insert(policies).values(input).returning();
      return created;
    }),
  update: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: nonEmptyObject({
          type: z
            .enum(['content_filter', 'tool_restriction', 'approval_required'])
            .optional(),
          rulesJson: rulesJsonSchema.optional(),
          enabled: z.boolean().optional(),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      const [updated] = await db
        .update(policies)
        .set({ ...input.data, updatedAt: new Date() })
        .where(eq(policies.id, input.id))
        .returning();
      return updated ?? null;
    }),
  delete: memberProcedure.input(idInput).mutation(async ({ input }) => {
    const [deleted] = await db
      .delete(policies)
      .where(eq(policies.id, input.id))
      .returning({ id: policies.id });
    return { id: deleted?.id ?? input.id, deleted: Boolean(deleted) };
  }),
  evaluateContent: memberProcedure
    .input(
      z.object({
        text: z.string().min(1),
        direction: z.enum(['inbound', 'outbound']),
      }),
    )
    .query(async ({ input, ctx }) => {
      const enabledPolicies = await db
        .select({ rulesJson: policies.rulesJson })
        .from(policies)
        .where(
          and(eq(policies.enabled, true), eq(policies.type, 'content_filter')),
        );
      const rulesList = enabledPolicies.map(
        (policy) => policy.rulesJson as Record<string, unknown>,
      );
      const result = evaluateContentPolicies(input.text, rulesList);
      await logAuditEvent({
        ...ctxActor(ctx),
        action: 'policy.content.evaluate',
        detail: JSON.stringify({
          direction: input.direction,
          allowed: result.allowed,
          reasons: result.reasons,
        }),
      });
      return { direction: input.direction, ...result };
    }),
  evaluateTool: memberProcedure
    .input(
      z.object({
        toolName: z.string().min(1),
        role: z.enum(['admin', 'member', 'viewer']).nullable().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const enabledPolicies = await db
        .select({ rulesJson: policies.rulesJson })
        .from(policies)
        .where(
          and(
            eq(policies.enabled, true),
            eq(policies.type, 'tool_restriction'),
          ),
        );
      const rulesList = enabledPolicies.map(
        (policy) => policy.rulesJson as Record<string, unknown>,
      );
      const result = evaluateToolPolicies(
        input.toolName,
        input.role ?? null,
        rulesList,
      );
      await logAuditEvent({
        ...ctxActor(ctx),
        action: 'policy.tool.evaluate',
        detail: JSON.stringify({
          toolName: input.toolName,
          role: input.role ?? null,
          allowed: result.allowed,
          reasons: result.reasons,
        }),
      });
      return result;
    }),
});

const policyRouter = t.router({
  queryConstraints: memberProcedure
    .input(
      z.object({
        agentId: z.string().min(1),
        role: z.enum(['admin', 'member', 'viewer']).nullable(),
        actionType: z.string().min(1),
      }),
    )
    .query(async ({ input }) =>
      getConstraints(
        {
          agentId: input.agentId,
          role: input.role,
        },
        input.actionType,
      ),
    ),
});

const auditRouter = t.router({
  list: authedProcedure
    .input(paginationInput.optional())
    .query(async ({ input }) => {
      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;
      const whereClause = input?.query
        ? or(
            ilike(auditEntries.actorId, `%${input.query}%`),
            ilike(auditEntries.action, `%${input.query}%`),
            ilike(auditEntries.detail, `%${input.query}%`),
          )
        : undefined;
      const itemsQuery = db
        .select()
        .from(auditEntries)
        .orderBy(desc(auditEntries.createdAt))
        .limit(limit)
        .offset(offset);
      const items = whereClause
        ? await itemsQuery.where(whereClause)
        : await itemsQuery;
      const total = await countRows(auditEntries, whereClause);
      return { items, total, limit, offset };
    }),
  get: authedProcedure.input(idInput).query(async ({ input }) => {
    const [item] = await db
      .select()
      .from(auditEntries)
      .where(eq(auditEntries.id, input.id))
      .limit(1);
    return item ?? null;
  }),
  create: memberProcedure
    .input(
      z.object({
        actorId: z.string().min(1),
        actorType: z.enum(['user', 'agent']),
        action: z.string().min(1),
        detail: z.string().min(1),
        costTokens: z.number().int().nonnegative().default(0),
        createdAt: z.coerce.date().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const created = await logAuditEvent({
        actorId: input.actorId,
        actorType: input.actorType,
        action: input.action,
        detail: input.detail,
        costTokens: input.costTokens,
      });
      await logAuditEvent({
        ...ctxActor(ctx),
        action: 'audit.entry.created',
        detail: JSON.stringify({
          entryId: created.id,
          sourceAction: input.action,
        }),
      });
      return created;
    }),
});

const approvalsRouter = t.router({
  list: authedProcedure
    .input(paginationInput.optional())
    .query(async ({ input }) => {
      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;
      const whereClause = input?.query
        ? or(
            ilike(approvalRequests.actionType, `%${input.query}%`),
            ilike(approvalRequests.state, `%${input.query}%`),
            ilike(approvalRequests.agentId, `%${input.query}%`),
          )
        : undefined;
      const itemsQuery = db
        .select()
        .from(approvalRequests)
        .orderBy(desc(approvalRequests.requestedAt))
        .limit(limit)
        .offset(offset);
      const items = whereClause
        ? await itemsQuery.where(whereClause)
        : await itemsQuery;
      const total = await countRows(approvalRequests, whereClause);
      return { items, total, limit, offset };
    }),
  get: authedProcedure.input(idInput).query(async ({ input }) => {
    const [item] = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, input.id))
      .limit(1);
    return item ?? null;
  }),
  create: memberProcedure
    .input(
      z.object({
        agentId: z.string().uuid(),
        actionType: z.string().min(1),
        params: paramsSchema.default({}),
        state: z
          .enum(['pending', 'approved', 'rejected', 'expired'])
          .default('pending'),
        requestedAt: z.coerce.date().optional(),
        decidedBy: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [created] = await db
        .insert(approvalRequests)
        .values({
          ...input,
          state: input.state ?? 'pending',
          requestedAt: input.requestedAt ?? undefined,
        })
        .returning();
      if (created) {
        await logAuditEvent({
          ...ctxActor(ctx),
          action: 'approval.request.created',
          detail: JSON.stringify({
            approvalId: created.id,
            agentId: created.agentId,
            actionType: created.actionType,
            state: created.state,
          }),
        });
      }
      return created;
    }),
  update: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: nonEmptyObject({
          actionType: z.string().min(1).optional(),
          params: paramsSchema.optional(),
          state: z
            .enum(['pending', 'approved', 'rejected', 'expired'])
            .optional(),
          requestedAt: z.coerce.date().optional(),
          decidedBy: z.string().uuid().nullable().optional(),
        }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [updated] = await db
        .update(approvalRequests)
        .set(input.data)
        .where(eq(approvalRequests.id, input.id))
        .returning();
      if (updated) {
        await logAuditEvent({
          ...ctxActor(ctx),
          action: 'approval.request.updated',
          detail: JSON.stringify({
            approvalId: updated.id,
            state: updated.state,
          }),
        });
      }
      return updated ?? null;
    }),
  listPending: authedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(20),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const limit = input?.limit ?? 20;
      const items = await db
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.state, 'pending'))
        .orderBy(desc(approvalRequests.requestedAt))
        .limit(limit);
      return { items, total: items.length, limit };
    }),
  checkToolCall: memberProcedure
    .input(
      z.object({
        agentId: z.string().uuid(),
        actionType: z.string().min(1).default('tool_call'),
        toolName: z.string().min(1),
        params: paramsSchema.default({}),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const enabledPolicies = await db
        .select({ rulesJson: policies.rulesJson })
        .from(policies)
        .where(
          and(
            eq(policies.enabled, true),
            eq(policies.type, 'approval_required'),
          ),
        );
      const rulesList = enabledPolicies.map(
        (policy) => policy.rulesJson as Record<string, unknown>,
      );
      const evaluation = evaluateApprovalPolicies(
        input.actionType,
        input.toolName,
        ctx.userRole,
        rulesList,
      );

      if (!evaluation.requiresApproval) {
        await logAuditEvent({
          ...ctxActor(ctx),
          action: 'approval.tool_call.allowed_without_gate',
          detail: JSON.stringify({
            agentId: input.agentId,
            actionType: input.actionType,
            toolName: input.toolName,
          }),
        });
        return {
          requiresApproval: false,
          state: 'approved' as const,
          approvalId: null,
          reasons: [],
        };
      }

      const [created] = await db
        .insert(approvalRequests)
        .values({
          agentId: input.agentId,
          actionType: input.actionType,
          params: { ...input.params, toolName: input.toolName },
          state: 'pending',
          decidedBy: null,
        })
        .returning();
      await logAuditEvent({
        ...ctxActor(ctx),
        action: 'approval.tool_call.gated',
        detail: JSON.stringify({
          approvalId: created.id,
          agentId: input.agentId,
          actionType: input.actionType,
          toolName: input.toolName,
          reasons: evaluation.reasons,
        }),
      });
      return {
        requiresApproval: true,
        state: created.state,
        approvalId: created.id,
        reasons: evaluation.reasons,
      };
    }),
  decide: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        decision: z.enum(['approved', 'rejected', 'expired']),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [existing] = await db
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.id, input.id))
        .limit(1);
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Approval request not found',
        });
      }
      if (
        !canTransitionApprovalState(
          existing.state as 'pending' | 'approved' | 'rejected' | 'expired',
          input.decision,
        )
      ) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Approval request is not pending',
        });
      }

      const [updated] = await db
        .update(approvalRequests)
        .set({
          state: input.decision,
          decidedBy:
            ctx.userId && /^[0-9a-fA-F-]{36}$/.test(ctx.userId)
              ? ctx.userId
              : null,
        })
        .where(eq(approvalRequests.id, input.id))
        .returning();
      await logAuditEvent({
        ...ctxActor(ctx),
        action: 'approval.request.decided',
        detail: JSON.stringify({
          approvalId: input.id,
          previousState: existing.state,
          decision: input.decision,
        }),
      });
      return updated ?? null;
    }),
  delete: adminProcedure.input(idInput).mutation(async ({ input }) => {
    const [deleted] = await db
      .delete(approvalRequests)
      .where(eq(approvalRequests.id, input.id))
      .returning({ id: approvalRequests.id });
    return { id: deleted?.id ?? input.id, deleted: Boolean(deleted) };
  }),
});

const documentsRouter = t.router({
  list: authedProcedure
    .input(paginationInput.optional())
    .query(async ({ input }) => {
      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;
      const whereClause = input?.query
        ? or(
            ilike(documents.filename, `%${input.query}%`),
            ilike(documents.mimeType, `%${input.query}%`),
            ilike(documents.storagePath, `%${input.query}%`),
          )
        : undefined;
      const itemsQuery = db
        .select()
        .from(documents)
        .orderBy(desc(documents.createdAt))
        .limit(limit)
        .offset(offset);
      const items = whereClause
        ? await itemsQuery.where(whereClause)
        : await itemsQuery;
      const total = await countRows(documents, whereClause);
      return { items, total, limit, offset };
    }),
  get: authedProcedure.input(idInput).query(async ({ input }) => {
    const [item] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, input.id))
      .limit(1);
    return item ?? null;
  }),
  create: memberProcedure
    .input(
      z.object({
        filename: z.string().min(1),
        mimeType: z.string().min(1),
        size: z.number().int().nonnegative(),
        uploadedBy: z.string().uuid(),
        storagePath: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const [created] = await db.insert(documents).values(input).returning();
      return created;
    }),
  update: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: nonEmptyObject({
          filename: z.string().min(1).optional(),
          mimeType: z.string().min(1).optional(),
          size: z.number().int().nonnegative().optional(),
          uploadedBy: z.string().uuid().optional(),
          storagePath: z.string().min(1).optional(),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      const [updated] = await db
        .update(documents)
        .set(input.data)
        .where(eq(documents.id, input.id))
        .returning();
      return updated ?? null;
    }),
  delete: memberProcedure.input(idInput).mutation(async ({ input }) => {
    const [deleted] = await db
      .delete(documents)
      .where(eq(documents.id, input.id))
      .returning({ id: documents.id });
    return { id: deleted?.id ?? input.id, deleted: Boolean(deleted) };
  }),
});

export const appRouter = t.router({
  users: usersRouter,
  agents: agentsRouter,
  policies: policiesRouter,
  policy: policyRouter,
  audit: auditRouter,
  approvals: approvalsRouter,
  documents: documentsRouter,
});

export type AppRouter = typeof appRouter;
