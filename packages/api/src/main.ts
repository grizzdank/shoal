import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import pinoHttp from 'pino-http';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './trpc/router.js';
import {
  evaluateMessageContent,
  evaluateToolCall,
  logToolResult,
} from './governance/service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.DASHBOARD_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });

  app.use(
    pinoHttp({
      transport: { target: 'pino-pretty' },
    }),
  );

  app.getHttpAdapter().get('/health', (_req: unknown, res: { json: (body: object) => void }) => {
    res.json({ status: 'ok' });
  });

  const http = app.getHttpAdapter().getInstance();
  http.post('/governance/message-received', async (req: { body: Record<string, unknown> }, res: { status: (code: number) => { json: (body: object) => void } }) => {
    try {
      const text = typeof req.body.text === 'string' ? req.body.text : '';
      const actorId = typeof req.body.actorId === 'string' ? req.body.actorId : 'agent';
      const result = await evaluateMessageContent({ text, direction: 'inbound', actorId });
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ error: 'governance_message_received_failed', detail: String(error) });
    }
  });

  http.post('/governance/message-sending', async (req: { body: Record<string, unknown> }, res: { status: (code: number) => { json: (body: object) => void } }) => {
    try {
      const text = typeof req.body.text === 'string' ? req.body.text : '';
      const actorId = typeof req.body.actorId === 'string' ? req.body.actorId : 'agent';
      const result = await evaluateMessageContent({ text, direction: 'outbound', actorId });
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ error: 'governance_message_sending_failed', detail: String(error) });
    }
  });

  http.post('/governance/before-tool-call', async (req: { body: Record<string, unknown> }, res: { status: (code: number) => { json: (body: object) => void } }) => {
    try {
      const actorId = typeof req.body.actorId === 'string' ? req.body.actorId : 'agent';
      const roleRaw = req.body.role;
      const role = roleRaw === 'admin' || roleRaw === 'member' || roleRaw === 'viewer' ? roleRaw : null;
      const agentId = typeof req.body.agentId === 'string' ? req.body.agentId : '';
      const actionType = typeof req.body.actionType === 'string' ? req.body.actionType : 'tool_call';
      const toolName = typeof req.body.toolName === 'string' ? req.body.toolName : '';
      const params =
        req.body.params && typeof req.body.params === 'object' && !Array.isArray(req.body.params)
          ? (req.body.params as Record<string, unknown>)
          : {};
      if (!agentId || !toolName) {
        res.status(400).json({ error: 'agentId and toolName are required' });
        return;
      }
      const result = await evaluateToolCall({
        actorId,
        role,
        agentId,
        actionType,
        toolName,
        params,
      });
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ error: 'governance_before_tool_call_failed', detail: String(error) });
    }
  });

  http.post('/governance/tool-result', async (req: { body: Record<string, unknown> }, res: { status: (code: number) => { json: (body: object) => void } }) => {
    try {
      const actorId = typeof req.body.actorId === 'string' ? req.body.actorId : 'agent';
      const toolName = typeof req.body.toolName === 'string' ? req.body.toolName : 'unknown';
      const detail =
        typeof req.body.detail === 'string' ? req.body.detail : JSON.stringify(req.body.result ?? {});
      const costTokens =
        typeof req.body.costTokens === 'number' && Number.isFinite(req.body.costTokens)
          ? Math.max(0, Math.floor(req.body.costTokens))
          : 0;
      await logToolResult({ actorId, toolName, detail, costTokens });
      res.status(200).json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: 'governance_tool_result_failed', detail: String(error) });
    }
  });

  http.post('/governance/before-agent-start', async (_req: unknown, res: { status: (code: number) => { json: (body: object) => void } }) => {
    res.status(200).json({
      governanceContext:
        'Shoal governance enabled: enforce content policies, tool restrictions, approval gates, and auditability.',
    });
  });

  app.use(
    '/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext: ({ req }: { req: { headers: Record<string, string | string[] | undefined> } }) => {
        const rawAuthHeader = req.headers.authorization;
        const rawUserRole = req.headers['x-shoal-user-role'];
        const userRole: 'admin' | 'member' | 'viewer' | null =
          rawUserRole === 'admin' || rawUserRole === 'member' || rawUserRole === 'viewer'
            ? rawUserRole
            : null;
        return {
          authHeader: typeof rawAuthHeader === 'string' ? rawAuthHeader : null,
          userId: typeof req.headers['x-shoal-user-id'] === 'string' ? req.headers['x-shoal-user-id'] : null,
          userRole,
        };
      },
    }),
  );

  await app.listen(3001);
}

bootstrap();
