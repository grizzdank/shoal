import type {
  ConstraintExpression,
  EvaluateInput,
  PolicyBackend,
  PolicyDecision,
  Principal,
} from '@shoal/shared';
import { and, eq } from 'drizzle-orm';
import { logAuditEvent } from '../audit/logging.js';
import { approvalRequests, policies } from '../db/schema.js';
import { evaluateApprovalPolicies, evaluateToolPolicies } from './engine.js';

type JsonRecord = Record<string, unknown>;
type DbClient = typeof import('../db/client.js').db;

function toJsonRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function appliesToRole(rules: JsonRecord, roleKey: string, role: string | null): boolean {
  const roles = asStringArray(rules[roleKey]);
  if (roles.length === 0) return true;
  return role !== null && roles.includes(role);
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export class NativePolicyEngine implements PolicyBackend {
  constructor(private readonly db: DbClient) {}

  async evaluate(input: EvaluateInput): Promise<PolicyDecision> {
    const toolPolicies = await this.db
      .select({ rulesJson: policies.rulesJson })
      .from(policies)
      .where(and(eq(policies.enabled, true), eq(policies.type, 'tool_restriction')));
    const toolRules = toolPolicies.map((policy) => policy.rulesJson as JsonRecord);
    const toolResult = evaluateToolPolicies(input.toolName, input.principal.role, toolRules);

    if (!toolResult.allowed) {
      await logAuditEvent({
        actorId: input.principal.agentId,
        actorType: 'agent',
        action: 'policy.tool.blocked',
        detail: JSON.stringify({
          toolName: input.toolName,
          reasons: toolResult.reasons,
        }),
      });
      return {
        permitted: false,
        approvalRequired: false,
        reasons: toolResult.reasons,
      };
    }

    const approvalPolicies = await this.db
      .select({ rulesJson: policies.rulesJson })
      .from(policies)
      .where(and(eq(policies.enabled, true), eq(policies.type, 'approval_required')));
    const approvalRules = approvalPolicies.map((policy) => policy.rulesJson as JsonRecord);
    const approvalEval = evaluateApprovalPolicies(
      input.actionType,
      input.toolName,
      input.principal.role,
      approvalRules,
    );

    if (!approvalEval.requiresApproval) {
      await logAuditEvent({
        actorId: input.principal.agentId,
        actorType: 'agent',
        action: 'approval.tool_call.not_required',
        detail: JSON.stringify({ toolName: input.toolName }),
      });
      return {
        permitted: true,
        approvalRequired: false,
        reasons: [],
      };
    }

    const [created] = await this.db
      .insert(approvalRequests)
      .values({
        agentId: input.principal.agentId,
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
      actorId: input.principal.agentId,
      actorType: 'agent',
      action: 'approval.tool_call.pending',
      detail: JSON.stringify({
        approvalId: created.id,
        toolName: input.toolName,
        reasons: approvalEval.reasons,
      }),
    });

    return {
      permitted: false,
      approvalRequired: true,
      approvalId: created.id,
      reasons: approvalEval.reasons,
    };
  }

  async queryConstraints(principal: Principal, actionType: string): Promise<ConstraintExpression> {
    const [toolPolicies, approvalPolicies] = await Promise.all([
      this.db
        .select({ rulesJson: policies.rulesJson })
        .from(policies)
        .where(and(eq(policies.enabled, true), eq(policies.type, 'tool_restriction'))),
      this.db
        .select({ rulesJson: policies.rulesJson })
        .from(policies)
        .where(and(eq(policies.enabled, true), eq(policies.type, 'approval_required'))),
    ]);

    const allowedTools = new Set<string>();
    const forbiddenTools = new Set<string>();

    for (const policy of toolPolicies) {
      const rules = policy.rulesJson as JsonRecord;
      if (!appliesToRole(rules, 'rolesAllowed', principal.role)) continue;
      for (const tool of asStringArray(rules.allowTools)) allowedTools.add(tool);
      for (const tool of asStringArray(rules.denyTools)) forbiddenTools.add(tool);
    }

    const requiresApproval = new Set<string>();

    for (const policy of approvalPolicies) {
      const rules = policy.rulesJson as JsonRecord;
      if (!appliesToRole(rules, 'rolesRequiringApproval', principal.role)) continue;

      const actionTypes = asStringArray(rules.actionTypes);
      const toolNames = asStringArray(rules.toolNames);
      const actionMatches = actionTypes.length === 0 || actionTypes.includes(actionType);

      if (!actionMatches) continue;

      if (toolNames.length > 0) {
        for (const tool of toolNames) requiresApproval.add(tool);
      } else {
        requiresApproval.add(actionType);
      }
    }

    const allowedToolsList = uniqueSorted(allowedTools);
    const forbiddenToolsList = uniqueSorted(forbiddenTools);
    const requiresApprovalList = uniqueSorted(requiresApproval);
    const roleLabel = principal.role ?? 'anonymous';
    const restrictedLabel = forbiddenToolsList.length > 0 ? forbiddenToolsList.join(', ') : 'none';
    const approvalLabel =
      requiresApprovalList.length > 0 ? requiresApprovalList.join(', ') : 'none';

    return {
      allowedTools: allowedToolsList,
      forbiddenTools: forbiddenToolsList,
      requiresApproval: requiresApprovalList,
      scopeNote: `Role: ${roleLabel}. Restricted: ${restrictedLabel}. Approval required: ${approvalLabel}.`,
    };
  }
}
