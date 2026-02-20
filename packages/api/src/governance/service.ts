import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import type { Principal } from '@shoal/shared';
import { policies } from '../db/schema.js';
import { evaluateContentPolicies } from '../policies/engine.js';
import { logAuditEvent } from '../audit/logging.js';
import { NativePolicyEngine } from '../policies/native-engine.js';

const policyBackend = new NativePolicyEngine(db);

export async function evaluateMessageContent(input: {
  text: string;
  direction: 'inbound' | 'outbound';
  actorId: string;
}) {
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
    actorId: input.actorId,
    actorType: 'agent',
    action: `policy.content.${input.direction}`,
    detail: JSON.stringify({
      allowed: result.allowed,
      reasons: result.reasons,
    }),
  });
  return result;
}

export async function evaluateToolCall(input: {
  actorId: string;
  role: 'admin' | 'member' | 'viewer' | null;
  agentId: string;
  actionType: string;
  toolName: string;
  params: Record<string, unknown>;
}) {
  const decision = await policyBackend.evaluate({
    principal: { agentId: input.agentId, role: input.role },
    actionType: input.actionType,
    toolName: input.toolName,
    params: input.params,
  });
  return {
    blocked: !decision.permitted,
    reasons: decision.reasons,
    approvalId: decision.approvalId ?? null,
  };
}

export async function getConstraints(principal: Principal, actionType: string) {
  return policyBackend.queryConstraints(principal, actionType);
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
