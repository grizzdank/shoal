export interface Principal {
  agentId: string;
  role: string | null;
}

export interface ConstraintExpression {
  allowedTools?: string[];
  forbiddenTools?: string[];
  requiresApproval?: string[];
  contentRestrictions?: string[];
  scopeNote?: string;
}

export interface EvaluateInput {
  principal: Principal;
  actionType: string;
  toolName: string;
  params?: Record<string, unknown>;
}

export interface PolicyDecision {
  permitted: boolean;
  approvalRequired: boolean;
  approvalId?: string;
  reasons: string[];
}

export interface PolicyBackend {
  evaluate(input: EvaluateInput): Promise<PolicyDecision>;
  queryConstraints(principal: Principal, actionType: string): Promise<ConstraintExpression>;
}
