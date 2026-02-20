import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  evaluateApprovalPolicies,
  evaluateContentPolicies,
  evaluateToolPolicies,
} from './engine.js';

describe('evaluateContentPolicies', () => {
  test('blocks configured blocked terms', () => {
    const result = evaluateContentPolicies('This contains ssn data', [
      { blockedTerms: ['ssn'] },
    ]);
    assert.equal(result.allowed, false);
    assert.ok(
      result.reasons.some((reason) => reason.startsWith('blocked_term:ssn')),
    );
  });

  test('blocks pii patterns by default', () => {
    const result = evaluateContentPolicies('Reach me at test@example.com', [
      {},
    ]);
    assert.equal(result.allowed, false);
    assert.ok(
      result.reasons.some((reason) => reason.startsWith('pii_detected:email')),
    );
  });

  test('allows safe text', () => {
    const result = evaluateContentPolicies('hello world', [
      { blockedTerms: ['forbidden'] },
    ]);
    assert.equal(result.allowed, true);
    assert.equal(result.reasons.length, 0);
  });
});

describe('evaluateToolPolicies', () => {
  test('denies explicitly denied tool', () => {
    const result = evaluateToolPolicies('wire_transfer', 'member', [
      { denyTools: ['wire_transfer'] },
    ]);
    assert.equal(result.allowed, false);
    assert.ok(result.reasons.includes('tool_denied:wire_transfer'));
  });

  test('enforces role restrictions', () => {
    const result = evaluateToolPolicies('search', 'viewer', [
      { rolesAllowed: ['admin', 'member'] },
    ]);
    assert.equal(result.allowed, false);
    assert.ok(result.reasons.includes('role_not_allowed:viewer'));
  });

  test('allows when all checks pass', () => {
    const result = evaluateToolPolicies('search', 'member', [
      { allowTools: ['search', 'read_doc'], rolesAllowed: ['member'] },
    ]);
    assert.equal(result.allowed, true);
    assert.equal(result.reasons.length, 0);
  });
});

describe('evaluateApprovalPolicies', () => {
  test('requires approval when policy matches', () => {
    const result = evaluateApprovalPolicies(
      'tool_call',
      'wire_transfer',
      'member',
      [
        {
          actionTypes: ['tool_call'],
          toolNames: ['wire_transfer'],
          rolesRequiringApproval: ['member', 'viewer'],
        },
      ],
    );
    assert.equal(result.requiresApproval, true);
    assert.ok(result.reasons.length > 0);
  });

  test('does not require approval when policy does not match', () => {
    const result = evaluateApprovalPolicies('tool_call', 'search', 'admin', [
      {
        actionTypes: ['tool_call'],
        toolNames: ['wire_transfer'],
        rolesRequiringApproval: ['member', 'viewer'],
      },
    ]);
    assert.equal(result.requiresApproval, false);
    assert.equal(result.reasons.length, 0);
  });
});
