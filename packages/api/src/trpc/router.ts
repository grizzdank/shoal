import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();
const procedure = t.procedure;

const idInput = z.object({ id: z.string() });
const anyRecord = z.record(z.string(), z.unknown()).optional();

const crudRouter = (entity: string) =>
  t.router({
    list: procedure.query(() => ({ entity, items: [] as unknown[] })),
    get: procedure.input(idInput).query(({ input }) => ({ entity, id: input.id })),
    create: procedure
      .input(z.object({ data: anyRecord.default({}) }))
      .mutation(({ input }) => ({ entity, created: input.data })),
    update: procedure
      .input(z.object({ id: z.string(), data: anyRecord.default({}) }))
      .mutation(({ input }) => ({ entity, updated: input.id, data: input.data })),
    delete: procedure.input(idInput).mutation(({ input }) => ({ entity, deleted: input.id })),
  });

export const appRouter = t.router({
  users: crudRouter('users'),
  agents: crudRouter('agents'),
  policies: crudRouter('policies'),
  audit: crudRouter('audit_entries'),
  approvals: crudRouter('approval_requests'),
  documents: crudRouter('documents'),
});

export type AppRouter = typeof appRouter;
