type JsonRecord = Record<string, unknown>;

export type ContentPolicyResult = {
  allowed: boolean;
  reasons: string[];
  matchedTerms: string[];
};

export type ToolPolicyResult = {
  allowed: boolean;
  reasons: string[];
};

export type ApprovalPolicyResult = {
  requiresApproval: boolean;
  reasons: string[];
};

const DEFAULT_PII_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'email', regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  {
    name: 'phone',
    regex: /\b(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/,
  },
  { name: 'ssn', regex: /\b\d{3}-\d{2}-\d{4}\b/ },
];

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string =>
      typeof item === 'string' && item.trim().length > 0,
  );
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function evaluateContentPolicies(
  text: string,
  rulesList: JsonRecord[],
): ContentPolicyResult {
  const reasons: string[] = [];
  const matchedTerms = new Set<string>();
  const normalized = text.toLowerCase();

  for (const rules of rulesList) {
    const blockedTerms = asStringArray(rules.blockedTerms).map((term) =>
      term.toLowerCase(),
    );
    const piiPatterns = asStringArray(rules.piiPatterns);
    const blockOnPii = asBoolean(rules.blockOnPii, true);

    for (const term of blockedTerms) {
      if (normalized.includes(term)) {
        matchedTerms.add(term);
        reasons.push(`blocked_term:${term}`);
      }
    }

    if (blockOnPii) {
      const configuredPatterns = piiPatterns
        .map((value) => {
          try {
            return new RegExp(value, 'i');
          } catch {
            return null;
          }
        })
        .filter((value): value is RegExp => value !== null);
      const patterns =
        configuredPatterns.length > 0
          ? configuredPatterns.map((regex) => ({
              name: `custom:${regex.source}`,
              regex,
            }))
          : DEFAULT_PII_PATTERNS;
      for (const pattern of patterns) {
        if (pattern.regex.test(text)) {
          reasons.push(`pii_detected:${pattern.name}`);
        }
      }
    }
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    matchedTerms: [...matchedTerms],
  };
}

export function evaluateToolPolicies(
  toolName: string,
  role: string | null,
  rulesList: JsonRecord[],
): ToolPolicyResult {
  const reasons: string[] = [];

  for (const rules of rulesList) {
    const allowTools = asStringArray(rules.allowTools);
    const denyTools = asStringArray(rules.denyTools);
    const rolesAllowed = asStringArray(rules.rolesAllowed);

    if (denyTools.includes(toolName)) {
      reasons.push(`tool_denied:${toolName}`);
    }

    if (allowTools.length > 0 && !allowTools.includes(toolName)) {
      reasons.push(`tool_not_allowlisted:${toolName}`);
    }

    if (rolesAllowed.length > 0 && (!role || !rolesAllowed.includes(role))) {
      reasons.push(`role_not_allowed:${role ?? 'anonymous'}`);
    }
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}

export function evaluateApprovalPolicies(
  actionType: string,
  toolName: string | null,
  role: string | null,
  rulesList: JsonRecord[],
): ApprovalPolicyResult {
  const reasons: string[] = [];

  for (const rules of rulesList) {
    const requiredActionTypes = asStringArray(rules.actionTypes);
    const requiredTools = asStringArray(rules.toolNames);
    const requiredRoles = asStringArray(rules.rolesRequiringApproval);

    const actionMatched =
      requiredActionTypes.length === 0 ||
      requiredActionTypes.includes(actionType);
    const toolMatched =
      requiredTools.length === 0 ||
      (toolName !== null && requiredTools.includes(toolName));
    const roleMatched =
      requiredRoles.length === 0 ||
      (role !== null && requiredRoles.includes(role));

    if (actionMatched && toolMatched && roleMatched) {
      reasons.push(
        `approval_policy_matched:action=${actionType}:tool=${toolName ?? 'none'}:role=${role ?? 'unknown'}`,
      );
    }
  }

  return {
    requiresApproval: reasons.length > 0,
    reasons,
  };
}
