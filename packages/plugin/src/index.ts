type HookContext = Record<string, unknown>;

type OpenClawPlugin = {
  hooks: {
    message_received: (ctx: HookContext) => Promise<HookContext>;
    message_sending: (ctx: HookContext) => Promise<HookContext>;
    before_tool_call: (ctx: HookContext) => Promise<HookContext>;
    tool_result_persist: (ctx: HookContext) => Promise<HookContext>;
    before_agent_start: (ctx: HookContext) => Promise<HookContext>;
  };
};

const plugin: OpenClawPlugin = {
  hooks: {
    async message_received(ctx) {
      console.log('[shoal] message_received: would apply content filtering', ctx);
      return ctx;
    },
    async message_sending(ctx) {
      console.log('[shoal] message_sending: would apply output filtering', ctx);
      return ctx;
    },
    async before_tool_call(ctx) {
      console.log('[shoal] before_tool_call: would check permissions/approval gate', ctx);
      return ctx;
    },
    async tool_result_persist(ctx) {
      console.log('[shoal] tool_result_persist: would write audit log entry', ctx);
      return ctx;
    },
    async before_agent_start(ctx) {
      console.log('[shoal] before_agent_start: would inject governance context', ctx);
      return ctx;
    },
  },
};

export default plugin;
