type HookContext = Record<string, unknown>;
type HookResponse = Record<string, unknown>;

type OpenClawPlugin = {
  hooks: {
    message_received: (ctx: HookContext) => Promise<HookContext>;
    message_sending: (ctx: HookContext) => Promise<HookContext>;
    before_tool_call: (ctx: HookContext) => Promise<HookContext>;
    tool_result_persist: (ctx: HookContext) => Promise<HookContext>;
    before_agent_start: (ctx: HookContext) => Promise<HookContext>;
  };
};

const governanceApiUrl =
  process.env.SHOAL_GOVERNANCE_API_URL ?? 'http://localhost:3001';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

async function callGovernance(
  path: string,
  payload: Record<string, unknown>,
): Promise<HookResponse> {
  try {
    const response = await fetch(`${governanceApiUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      return { error: 'governance_http_error', status: response.status };
    }
    return (await response.json()) as HookResponse;
  } catch (error) {
    return { error: 'governance_unreachable', detail: String(error) };
  }
}

const plugin: OpenClawPlugin = {
  hooks: {
    async message_received(ctx) {
      const result = await callGovernance('/governance/message-received', {
        actorId: asString(ctx.agentId, 'agent'),
        text: asString(ctx.content),
      });
      if (result.allowed === false) {
        return { ...ctx, blocked: true, blockReasons: result.reasons ?? [] };
      }
      return ctx;
    },
    async message_sending(ctx) {
      const result = await callGovernance('/governance/message-sending', {
        actorId: asString(ctx.agentId, 'agent'),
        text: asString(ctx.content),
      });
      if (result.allowed === false) {
        return { ...ctx, blocked: true, blockReasons: result.reasons ?? [] };
      }
      return ctx;
    },
    async before_tool_call(ctx) {
      const result = await callGovernance('/governance/before-tool-call', {
        actorId: asString(ctx.agentId, 'agent'),
        role: asString(ctx.role) || 'member',
        agentId: asString(ctx.agentId),
        actionType: asString(ctx.actionType, 'tool_call'),
        toolName: asString(ctx.toolName),
        params: asRecord(ctx.params),
      });
      if (result.blocked === true) {
        return {
          ...ctx,
          blocked: true,
          approvalId: result.approvalId ?? null,
          blockReasons: result.reasons ?? [],
        };
      }
      return ctx;
    },
    async tool_result_persist(ctx) {
      await callGovernance('/governance/tool-result', {
        actorId: asString(ctx.agentId, 'agent'),
        toolName: asString(ctx.toolName, 'unknown'),
        result: ctx.result,
        detail: asString(ctx.detail),
        costTokens: typeof ctx.costTokens === 'number' ? ctx.costTokens : 0,
      });
      return ctx;
    },
    async before_agent_start(ctx) {
      const result = await callGovernance('/governance/before-agent-start', {
        agentId: asString(ctx.agentId),
      });
      if (typeof result.governanceContext === 'string') {
        const systemPrompt = asString(ctx.systemPrompt);
        return {
          ...ctx,
          systemPrompt: systemPrompt
            ? `${systemPrompt}\n\n${result.governanceContext}`
            : result.governanceContext,
        };
      }
      return ctx;
    },
  },
};

export default plugin;
