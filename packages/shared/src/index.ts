export enum UserRole {
  admin = 'admin',
  member = 'member',
  viewer = 'viewer',
}

export enum PolicyType {
  contentFilter = 'content_filter',
  toolPermission = 'tool_permission',
  approvalGate = 'approval_gate',
  dataRetention = 'data_retention',
}

export enum ApprovalState {
  pending = 'pending',
  approved = 'approved',
  denied = 'denied',
}

export enum ActorType {
  user = 'user',
  agent = 'agent',
  system = 'system',
}

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
};

export type Agent = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Policy = {
  id: string;
  name: string;
  type: PolicyType;
  rules: Record<string, unknown>;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AuditEntry = {
  id: string;
  actorType: ActorType;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type ApprovalRequest = {
  id: string;
  state: ApprovalState;
  requestedBy: string;
  approverId: string | null;
  reason: string;
  payload: Record<string, unknown>;
  createdAt: Date;
  resolvedAt: Date | null;
};

export type Document = {
  id: string;
  title: string;
  path: string;
  contentType: string;
  uploadedBy: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
};
