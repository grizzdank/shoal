import type { ConstraintExpression } from '@shoal/shared';

export function formatConstraintsForPrompt(c: ConstraintExpression): string {
  const lines: string[] = ['[Policy Constraints]'];
  if (c.forbiddenTools?.length) lines.push(`Restricted tools: ${c.forbiddenTools.join(', ')}`);
  if (c.allowedTools?.length) lines.push(`Permitted tools: ${c.allowedTools.join(', ')}`);
  if (c.requiresApproval?.length) lines.push(`Requires approval: ${c.requiresApproval.join(', ')}`);
  if (c.contentRestrictions?.length)
    lines.push(`Content restrictions: ${c.contentRestrictions.join(', ')}`);
  if (c.scopeNote) lines.push(c.scopeNote);
  return lines.join('\n');
}
