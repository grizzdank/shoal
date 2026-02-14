export type ApprovalState = 'pending' | 'approved' | 'rejected' | 'expired';

export function canTransitionApprovalState(from: ApprovalState, to: ApprovalState): boolean {
  if (from !== 'pending') return false;
  return to === 'approved' || to === 'rejected' || to === 'expired';
}
