import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { canTransitionApprovalState } from './state.js';

describe('canTransitionApprovalState', () => {
  test('allows pending to terminal states', () => {
    assert.equal(canTransitionApprovalState('pending', 'approved'), true);
    assert.equal(canTransitionApprovalState('pending', 'rejected'), true);
    assert.equal(canTransitionApprovalState('pending', 'expired'), true);
  });

  test('disallows non-pending transitions', () => {
    assert.equal(canTransitionApprovalState('approved', 'rejected'), false);
    assert.equal(canTransitionApprovalState('rejected', 'approved'), false);
    assert.equal(canTransitionApprovalState('expired', 'approved'), false);
  });

  test('disallows pending to pending', () => {
    assert.equal(canTransitionApprovalState('pending', 'pending'), false);
  });
});
