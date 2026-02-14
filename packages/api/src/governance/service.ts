import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { approvalRequests, policies } from '../db/schema.js';
import {
  evaluateApprovalPolicies,
  evaluateContentPolicies,
  evaluateToolPolicies,
} from '../policies/engine.js';
import { logAuditEvent } from '../audit/logging.js';

type Role = 'admin' | 'member' | 'viewer' | null;

function toJsonRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function evaluateMessageContent(input: {
  text: string;
  direction: 'inbound' | 'outbound';
  actorId: string;
}) {
  const enabledPolicies = await db
    .select({ rulesJson: policies.rulesJson })
    .from(policies)
    .where(and(eq(policies.enabled, true), eq(policies.type, 'content_filter')));
  const rulesList = enabledPolicies.map((policy) => policy.rulesJson as Record<string, unknown>);
  const result = evaluateContentPolicies(input.text, rulesList);
  await logAuditEvent({
    actorId: input.actorId,
    actorType: 'agent',
    action: `policy.content.${input.direction}`,
    detail: JSON.stringify({ allowed: result.allowed, reasons: result.reasons }),
  });
  return result;
}

export async function evaluateToolCall(input: {
  actorId: string;
  role: Role;
  agentId: string;
  actionType: string;
  toolName: string;
  params: Record<string, unknown>;
}) {
  const toolPolicies = await db
    .select({ rulesJson: policies.rulesJson })
    .from(policies)
    .where(and(eq(policies.enabled, true), eq(policies.type, 'tool_restriction')));
  const toolRules = toolPolicies.map((policy) => policy.rulesJson as Record<string, unknown>);
  const toolResult = evaluateToolPolicies(input.toolName, input.role, toolRules);
  if (!toolResult.allowed) {
    await logAuditEvent({
      actorId: input.actorId,
      actorType: 'agent',
      action: 'policy.tool.blocked',
      detail: JSON.stringify({
        toolName: input.toolName,
        reasons: toolResult.reasons,
      }),
    });
    return { blocked: true, reasons: toolResult.reasons, approvalId: null };
  }

  const approvalPolicies = await db
    .select({ rulesJson: policies.rulesJson })
    .from(policies)
    .where(and(eq(policies.enabled, true), eq(policies.type, 'approval_required')));
  const approvalRules = approvalPolicies.map((policy) => policy.rulesJson as Record<string, unknown>);
  const approvalEval = evaluateApprovalPolicies(
    input.actionType,
    input.toolName,
    input.role,
    approvalRules,
  );

  if (!approvalEval.requiresApproval) {
    await logAuditEvent({
      actorId: input.actorId,
      actorType: 'agent',
      action: 'approval.tool_call.not_required',
      detail: JSON.stringify({ toolName: input.toolName }),
    });
    return { blocked: false, reasons: [], approvalId: null };
  }

  const [created] = await db
    .insert(approvalRequests)
    .values({
      agentId: input.agentId,
      actionType: input.actionType,
      params: {
        ...toJsonRecord(input.params),
        toolName: input.toolName,
      },
      state: 'pending',
      decidedBy: null,
    })
    .returning();
  await logAuditEvent({
    actorId: input.actorId,
    actorType: 'agent',
    action: 'approval.tool_call.pending',
    detail: JSON.stringify({
      approvalId: created.id,
      toolName: input.toolName,
      reasons: approvalEval.reasons,
    }),
  });
  return { blocked: true, reasons: approvalEval.reasons, approvalId: created.id };
}

export async function logToolResult(input: {
  actorId: string;
  toolName: string;
  detail: string;
  costTokens: number;
}) {
  await logAuditEvent({
    actorId: input.actorId,
    actorType: 'agent',
    action: `tool.result.${input.toolName}`,
    detail: input.detail,
    costTokens: input.costTokens,
  });
}
